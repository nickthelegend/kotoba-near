//! Kotoba mention markets: one binary market per word, traded on a central limit order book.
//!
//! Each word market has YES and NO shares. A YES share pays 0.001 NEAR if the word appears in the
//! official transcript at least `threshold` times, otherwise the NO share pays. Prices are in cents
//! of that payout (1-99), so a YES price of 62 means the market gives the word a 62% chance.
//!
//! Matching is Polymarket-style: a YES bid at p crosses a YES ask at <= p (shares change hands),
//! a NO bid at q >= 100 - p (a new YES/NO pair is minted from both bids), or, for sellers, a NO ask
//! at q <= 100 - p (the pair is merged and its collateral paid out). Every share is backed by
//! exactly one payout unit, so the book can never pay out more than it holds.
//!
//! Resolution is unchanged from the earlier contract: a pinned OutLayer program fetches the official
//! Federal Reserve PDF inside a TEE and returns the whole-word count; one bonded challenge reruns it.

use near_sdk::borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use std::collections::BTreeMap;

/// Payout of one winning share: 0.001 NEAR.
pub const UNIT: u128 = 1_000_000_000_000_000_000_000;
/// One cent of that payout.
pub const CENT: u128 = UNIT / 100;
/// Charged once per order or mint to pay for the state it adds (orders, fills, balances). Not refunded.
pub const ORDER_FEE: u128 = 3 * UNIT;
const MIN_WINDOW_NS: u64 = 10 * 60 * 1_000_000_000;
const BOND: u128 = 100 * UNIT; // 0.1 NEAR resolver or challenger bond
const OUTLAYER: &str = "outlayer.testnet";
const MAX_MARKETS: usize = 64;
const MAX_OPEN_ORDERS: usize = 2048;
const MAX_TRADES: usize = 6000;
const MAX_ACCOUNTS: usize = 2048;
/// Upper bound on resting orders one taker can match, to keep gas bounded.
const MAX_MAKERS: usize = 48;

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum Status {
    Open,
    Provisional,
    Final,
}

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct OracleOutput {
    pub count: u32,
    pub transcript_sha256: String,
    pub source_url: String,
    pub code_hash: String,
    #[serde(default)]
    pub attestation: String,
}

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Market {
    pub id: String,
    /// Groups word markets into one event page, e.g. `fed-2026-12-09`.
    pub event_id: String,
    pub event: String,
    pub source_url: String,
    pub phrase: String,
    pub threshold: u32,
    pub close_ns: u64,
    pub deadline_ns: u64,
    /// YES and NO shares ever created; minus the burned counts this is the outstanding supply.
    pub yes: u32,
    pub no: u32,
    pub burned_yes: u32,
    pub burned_no: u32,
    pub creator: String,
    pub status: Status,
    pub result: Option<OracleOutput>,
    pub challenge_until_ns: Option<u64>,
    pub pending: bool,
    pub resolver: Option<String>,
    pub challenger: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Order {
    pub order_id: u64,
    pub market_id: String,
    pub owner: String,
    /// Which share the order trades.
    pub yes: bool,
    pub buy: bool,
    /// Limit price in cents of the payout for that share.
    pub price: u32,
    pub quantity: u32,
    pub remaining: u32,
    pub created_ns: u64,
    pub cancelled: bool,
}

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Trade {
    pub trade_id: u64,
    pub market_id: String,
    /// The taker's share and the price the taker paid or received for it.
    pub yes: bool,
    pub price: u32,
    /// The same fill expressed as a YES price, for charts.
    pub yes_price: u32,
    pub quantity: u32,
    pub maker: String,
    pub taker: String,
    pub maker_order: u64,
    pub taker_order: u64,
    pub taker_buy: bool,
    /// `swap` (shares changed hands), `mint` (two bids created a pair) or `merge` (two asks redeemed a pair).
    pub kind: String,
    pub at_ns: u64,
}

/// One price level of the YES book. NO orders appear mirrored at 100 - price.
#[derive(Serialize, schemars::JsonSchema, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Level {
    pub price: u32,
    pub shares: u32,
    pub orders: u32,
}

#[derive(Serialize, schemars::JsonSchema, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Book {
    pub market_id: String,
    /// Best first: highest YES bid, lowest YES ask.
    pub bids: Vec<Level>,
    pub asks: Vec<Level>,
    pub last_yes_price: Option<u32>,
    pub spread: Option<u32>,
}

#[derive(Serialize, schemars::JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    token_id: String,
    owner_id: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Kotoba {
    markets: BTreeMap<String, Market>,
    shares: BTreeMap<(String, String, bool), u32>,
    wasm_url: String,
    wasm_hash: String,
    challenge_window_ns: u64,
    /// Open orders only; filled and cancelled orders are removed (their fills live in `trades`).
    orders: BTreeMap<u64, Order>,
    trades: Vec<Trade>,
    cash: BTreeMap<String, u128>,
    withdrawals: BTreeMap<String, u128>,
    next_order: u64,
}

/// A resting order that a taker can match, seen from the taker's share.
struct Candidate {
    order: Order,
    effective: u32,
    complementary: bool,
}

#[near]
impl Kotoba {
    #[init]
    pub fn new(wasm_url: String, wasm_hash: String, challenge_window_ns: u64) -> Self {
        require!(wasm_url.starts_with("https://"), "ERR_WASM_URL");
        // OutLayer refuses an uppercase hash, so a mixed-case pin could never resolve.
        require!(is_sha256(&wasm_hash) && wasm_hash.bytes().all(|b| !b.is_ascii_uppercase()), "ERR_WASM_HASH");
        require!(challenge_window_ns >= MIN_WINDOW_NS, "ERR_WINDOW");
        Self {
            markets: BTreeMap::new(),
            shares: BTreeMap::new(),
            wasm_url,
            wasm_hash,
            challenge_window_ns,
            orders: BTreeMap::new(),
            trades: Vec::new(),
            cash: BTreeMap::new(),
            withdrawals: BTreeMap::new(),
            next_order: 1,
        }
    }

    /// The pinned oracle program and the challenge window every market uses.
    pub fn config(&self) -> (String, String, u64) {
        (self.wasm_url.clone(), self.wasm_hash.clone(), self.challenge_window_ns)
    }

    /// Markets are listed by the operator (the contract account), like an exchange lists contracts.
    pub fn create_market(&mut self, id: String, event_id: String, event: String, source_url: String, phrase: String, threshold: u32, close_ns: u64, deadline_ns: u64) {
        require!(env::predecessor_account_id() == env::current_account_id(), "ERR_OPERATOR_ONLY");
        require!(self.markets.len() < MAX_MARKETS && valid_id(&id) && !self.markets.contains_key(&id), "ERR_MARKET_ID");
        require!(valid_id(&event_id), "ERR_EVENT_ID");
        require!(valid_source(&source_url), "ERR_SOURCE");
        require!(!event.is_empty() && event.len() <= 120, "ERR_EVENT");
        require!(valid_phrase(&phrase), "ERR_PHRASE");
        require!(threshold > 0, "ERR_PARAMETERS");
        require!(close_ns > env::block_timestamp() && deadline_ns > close_ns, "ERR_TIME");
        self.markets.insert(
            id.clone(),
            Market {
                id,
                event_id,
                event,
                source_url,
                phrase: phrase.to_ascii_lowercase(),
                threshold,
                close_ns,
                deadline_ns,
                yes: 0,
                no: 0,
                burned_yes: 0,
                burned_no: 0,
                creator: env::predecessor_account_id().to_string(),
                status: Status::Open,
                result: None,
                challenge_until_ns: None,
                pending: false,
                resolver: None,
                challenger: None,
            },
        );
    }

    // ---------------------------------------------------------------- trading

    /// Adds attached NEAR (minus the fee) to the caller's trading cash.
    #[payable]
    pub fn deposit(&mut self) {
        let owner = env::predecessor_account_id().to_string();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount >= ORDER_FEE, "ERR_DEPOSIT");
        self.credit(&owner, amount - ORDER_FEE);
    }

    /// Locks `quantity` payout units and returns one YES and one NO share for each.
    #[payable]
    pub fn mint_pairs(&mut self, id: String, quantity: u32) {
        self.trading(&id);
        require!(quantity > 0 && quantity <= 100_000, "ERR_QUANTITY");
        let amount = quantity as u128 * UNIT;
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= ORDER_FEE, "ERR_DEPOSIT");
        let owner = env::predecessor_account_id().to_string();
        self.credit(&owner, attached - ORDER_FEE);
        self.debit(&owner, amount);
        self.add_shares(&id, &owner, true, quantity);
        self.add_shares(&id, &owner, false, quantity);
        let m = self.markets.get_mut(&id).unwrap();
        m.yes = m.yes.checked_add(quantity).expect("ERR_OVERFLOW");
        m.no = m.no.checked_add(quantity).expect("ERR_OVERFLOW");
    }

    /// Returns `quantity` YES+NO pairs for their locked payout units.
    #[payable]
    pub fn redeem_pairs(&mut self, id: String, quantity: u32) {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        self.trading(&id);
        require!(quantity > 0, "ERR_QUANTITY");
        let owner = env::predecessor_account_id().to_string();
        self.take_shares(&id, &owner, true, quantity);
        self.take_shares(&id, &owner, false, quantity);
        let m = self.markets.get_mut(&id).unwrap();
        m.burned_yes = m.burned_yes.checked_add(quantity).expect("ERR_OVERFLOW");
        m.burned_no = m.burned_no.checked_add(quantity).expect("ERR_OVERFLOW");
        self.credit(&owner, quantity as u128 * UNIT);
    }

    /// Places a limit order (rests if not fully filled) or a market order (the rest is returned).
    /// Fills happen at each resting order's price, best price first, then oldest first.
    /// Buying escrows `price × quantity` cents from cash plus the attached deposit; selling escrows shares.
    #[payable]
    pub fn place_order(&mut self, id: String, yes: bool, buy: bool, price: u32, quantity: u32, kind: String) -> Order {
        self.trading(&id);
        require!((1..=99).contains(&price), "ERR_PRICE");
        require!(quantity > 0 && quantity <= 100_000, "ERR_QUANTITY");
        require!(kind == "limit" || kind == "market", "ERR_KIND");
        require!(self.orders.len() < MAX_OPEN_ORDERS, "ERR_BOOK_CAP");
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= ORDER_FEE, "ERR_ORDER_FEE");
        let owner = env::predecessor_account_id().to_string();
        self.credit(&owner, attached - ORDER_FEE);
        if buy {
            self.debit(&owner, price as u128 * CENT * quantity as u128);
        } else {
            self.take_shares(&id, &owner, yes, quantity);
        }

        let order_id = self.next_order;
        self.next_order += 1;
        let now = env::block_timestamp();
        let mut taker = Order { order_id, market_id: id.clone(), owner: owner.clone(), yes, buy, price, quantity, remaining: quantity, created_ns: now, cancelled: false };

        let candidates = self.crossing(&taker);
        require!(candidates.iter().all(|c| c.order.owner != owner), "ERR_SELF_CROSS");
        for c in candidates.into_iter().take(MAX_MAKERS) {
            if taker.remaining == 0 {
                break;
            }
            require!(self.trades.len() < MAX_TRADES, "ERR_TRADE_CAP");
            let mut maker = c.order;
            let fill = taker.remaining.min(maker.remaining);
            let e = c.effective;
            let kind = match (c.complementary, buy) {
                // Same share, opposite side: shares move from seller to buyer at the maker's price.
                (false, true) => {
                    self.add_shares(&id, &owner, yes, fill);
                    self.credit(&maker.owner, cents(e, fill));
                    self.credit(&owner, cents(price - e, fill)); // price improvement
                    "swap"
                }
                (false, false) => {
                    self.add_shares(&id, &maker.owner, yes, fill);
                    self.credit(&owner, cents(e, fill));
                    "swap"
                }
                // Two bids on opposite shares: their escrow adds up to one payout unit, so mint a pair.
                (true, true) => {
                    self.add_shares(&id, &owner, yes, fill);
                    self.add_shares(&id, &maker.owner, !yes, fill);
                    self.credit(&owner, cents(price - e, fill));
                    let m = self.markets.get_mut(&id).unwrap();
                    m.yes = m.yes.checked_add(fill).expect("ERR_OVERFLOW");
                    m.no = m.no.checked_add(fill).expect("ERR_OVERFLOW");
                    "mint"
                }
                // Two asks on opposite shares: burn the pair and split its payout unit.
                (true, false) => {
                    self.credit(&maker.owner, cents(maker.price, fill));
                    self.credit(&owner, cents(e, fill));
                    let m = self.markets.get_mut(&id).unwrap();
                    m.burned_yes = m.burned_yes.checked_add(fill).expect("ERR_OVERFLOW");
                    m.burned_no = m.burned_no.checked_add(fill).expect("ERR_OVERFLOW");
                    "merge"
                }
            };
            maker.remaining -= fill;
            taker.remaining -= fill;
            if maker.remaining == 0 {
                self.orders.remove(&maker.order_id);
            } else {
                self.orders.insert(maker.order_id, maker.clone());
            }
            let trade = Trade {
                trade_id: self.trades.len() as u64 + 1,
                market_id: id.clone(),
                yes,
                price: e,
                yes_price: if yes { e } else { 100 - e },
                quantity: fill,
                maker: maker.owner.clone(),
                taker: owner.clone(),
                maker_order: maker.order_id,
                taker_order: order_id,
                taker_buy: buy,
                kind: kind.into(),
                at_ns: now,
            };
            env::log_str(&json!({"event": "trade", "data": trade}).to_string());
            self.trades.push(trade);
        }
        if taker.remaining > 0 && kind == "market" {
            self.release(&taker);
            taker.remaining = 0;
            taker.cancelled = true;
        }
        if taker.remaining > 0 {
            self.orders.insert(order_id, taker.clone());
        }
        env::log_str(&json!({"event": "order", "data": taker}).to_string());
        taker
    }

    /// Cancels the caller's own resting order and returns its escrow. Allowed after trading closes.
    #[payable]
    pub fn cancel_order(&mut self, order_id: u64) -> Order {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        let mut o = self.orders.get(&order_id).cloned().expect("ERR_ORDER_CLOSED");
        require!(o.owner == env::predecessor_account_id().as_str(), "ERR_ORDER_OWNER");
        self.release(&o);
        self.orders.remove(&order_id);
        o.remaining = 0;
        o.cancelled = true;
        env::log_str(&json!({"event": "cancel", "data": o}).to_string());
        o
    }

    /// Sends trading cash back to the caller's wallet. The debit happens first; a failed transfer is re-credited.
    #[payable]
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        let owner = env::predecessor_account_id().to_string();
        require!(amount.0 > 0 && !self.withdrawals.contains_key(&owner), "ERR_WITHDRAW_PENDING");
        self.debit(&owner, amount.0);
        self.withdrawals.insert(owner.clone(), amount.0);
        Promise::new(owner.parse().unwrap())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).on_book_withdraw(owner, amount))
    }

    #[private]
    pub fn on_book_withdraw(&mut self, owner: String, amount: U128) -> bool {
        require!(env::promise_results_count() == 1, "ERR_PROMISE_COUNT");
        require!(self.withdrawals.remove(&owner) == Some(amount.0), "ERR_WITHDRAW_PENDING");
        let ok = env::promise_result_checked(0, 16).is_ok();
        if !ok {
            self.credit(&owner, amount.0);
        }
        ok
    }

    // ------------------------------------------------------------- resolution

    #[payable]
    pub fn resolve(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Open && !m.pending, "ERR_STATE");
        require!(env::block_timestamp() >= m.close_ns && env::block_timestamp() <= m.deadline_ns, "ERR_RESOLUTION_TIME");
        require!(env::attached_deposit().as_yoctonear() > BOND, "ERR_RESOLVER_BOND");
        m.pending = true;
        m.resolver = Some(env::predecessor_account_id().to_string());
        self.request(id, false, NearToken::from_yoctonear(env::attached_deposit().as_yoctonear() - BOND))
    }

    #[payable]
    pub fn challenge(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Provisional && !m.pending, "ERR_STATE");
        require!(env::block_timestamp() < m.challenge_until_ns.unwrap(), "ERR_WINDOW");
        // A fixed 0.1 NEAR bond is retained until callback. Re-running the same code is the sole adjudicator.
        require!(env::attached_deposit().as_yoctonear() > BOND, "ERR_BOND");
        m.pending = true;
        m.challenger = Some(env::predecessor_account_id().to_string());
        self.request(id, true, NearToken::from_yoctonear(env::attached_deposit().as_yoctonear() - BOND))
    }

    #[private]
    pub fn on_result(&mut self, id: String, challenged: bool) -> bool {
        let window = self.challenge_window_ns;
        let wasm_hash = self.wasm_hash.clone();
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.pending, "ERR_NOT_PENDING");
        m.pending = false;
        require!(env::promise_results_count() == 1, "ERR_PROMISE_COUNT");
        let Ok(bytes) = env::promise_result_checked(0, 900) else {
            refund_bond(m, challenged);
            env::log_str("OutLayer execution failed; resolution remains open");
            return false;
        };
        let Ok(output) = serde_json::from_slice::<OracleOutput>(&bytes) else {
            refund_bond(m, challenged);
            env::log_str("OutLayer returned invalid oracle JSON; resolution remains open");
            return false;
        };
        if output.source_url != m.source_url || output.code_hash != wasm_hash || !is_sha256(&output.transcript_sha256) {
            refund_bond(m, challenged);
            env::log_str("OutLayer returned source or code hash mismatch; resolution remains open");
            return false;
        }
        if challenged {
            let previous = m.result.as_ref().unwrap();
            let changed = previous.count != output.count || previous.transcript_sha256 != output.transcript_sha256;
            let winner = if changed { m.challenger.take().unwrap() } else { m.resolver.take().unwrap() };
            Promise::new(winner.parse().unwrap()).transfer(NearToken::from_yoctonear(2 * BOND)).detach();
            // One challenge is allowed. Its rerun is final, with no human override.
            m.result = Some(output);
            m.status = Status::Final;
            m.challenger = None;
            m.resolver = None;
            m.challenge_until_ns = None;
            return true;
        }
        m.result = Some(output);
        m.status = Status::Provisional;
        m.challenge_until_ns = Some(env::block_timestamp() + window);
        true
    }

    pub fn finalize(&mut self, id: String) {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Provisional && !m.pending && env::block_timestamp() >= m.challenge_until_ns.unwrap(), "ERR_WINDOW");
        m.status = Status::Final;
        if let Some(account) = m.resolver.take() {
            Promise::new(account.parse().unwrap()).transfer(NearToken::from_yoctonear(BOND)).detach();
        }
    }

    /// Pays 0.001 NEAR per winning share held (cancel resting sell orders first to unlock their shares).
    pub fn claim(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Final, "ERR_NOT_FINAL");
        let account = env::predecessor_account_id();
        let winning_yes = m.result.as_ref().unwrap().count >= m.threshold;
        let qty = self.shares.remove(&(id.clone(), account.to_string(), winning_yes)).unwrap_or(0);
        require!(qty > 0, "ERR_NO_WINNING_SHARES");
        if winning_yes { m.burned_yes += qty; } else { m.burned_no += qty; }
        mt_event("mt_burn", json!({"owner_id": account, "token_ids": [token_id(&id, winning_yes)], "amounts": [qty.to_string()]}));
        Promise::new(account).transfer(NearToken::from_yoctonear(qty as u128 * UNIT))
    }

    /// If nothing settled by the deadline, every share redeems for half a unit. Every share came from a
    /// fully backed pair, so outstanding YES = outstanding NO and the half-unit payout is exactly covered.
    pub fn claim_void(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Open && !m.pending && env::block_timestamp() > m.deadline_ns, "ERR_NOT_VOID");
        let account = env::predecessor_account_id();
        let yes = self.shares.remove(&(id.clone(), account.to_string(), true)).unwrap_or(0);
        let no = self.shares.remove(&(id.clone(), account.to_string(), false)).unwrap_or(0);
        require!(yes + no > 0, "ERR_NO_SHARES");
        m.burned_yes += yes;
        m.burned_no += no;
        Promise::new(account).transfer(NearToken::from_yoctonear((yes + no) as u128 * UNIT / 2))
    }

    // ------------------------------------------------------------------ views

    pub fn get_market(&self, id: String) -> Option<Market> {
        self.markets.get(&id).cloned()
    }
    pub fn list_markets(&self) -> Vec<Market> {
        self.markets.values().cloned().collect()
    }
    pub fn balance_of(&self, id: String, account: AccountId, yes: bool) -> u32 {
        self.shares.get(&(id, account.to_string(), yes)).copied().unwrap_or(0)
    }
    pub fn cash_balance(&self, account: String) -> U128 {
        U128(self.cash.get(&account).copied().unwrap_or(0))
    }
    pub fn account_orders(&self, account: String) -> Vec<Order> {
        self.orders.values().filter(|o| o.owner == account).cloned().collect()
    }
    pub fn trade_history(&self, id: String) -> Vec<Trade> {
        self.trades.iter().filter(|t| t.market_id == id).cloned().collect()
    }

    /// The YES book of one word: YES orders at their price, NO orders mirrored at 100 - price.
    pub fn get_book(&self, id: String) -> Book {
        let mut bids: BTreeMap<u32, Level> = BTreeMap::new();
        let mut asks: BTreeMap<u32, Level> = BTreeMap::new();
        for o in self.orders.values().filter(|o| o.market_id == id) {
            // A YES bid and a NO ask both want YES to be worth more; they form the bid side.
            let (is_bid, price) = if o.yes { (o.buy, o.price) } else { (!o.buy, 100 - o.price) };
            let side = if is_bid { &mut bids } else { &mut asks };
            let level = side.entry(price).or_insert(Level { price, shares: 0, orders: 0 });
            level.shares += o.remaining;
            level.orders += 1;
        }
        let bids: Vec<Level> = bids.into_values().rev().collect();
        let asks: Vec<Level> = asks.into_values().collect();
        let spread = bids.first().zip(asks.first()).map(|(b, a)| a.price.saturating_sub(b.price));
        let last_yes_price = self.trades.iter().rev().find(|t| t.market_id == id).map(|t| t.yes_price);
        Book { market_id: id, bids, asks, last_yes_price, spread }
    }

    /// One coherent read for the app: every market, book and fill, plus one account's balances.
    pub fn snapshot(&self, account: Option<String>) -> Value {
        let mut books = serde_json::Map::new();
        let mut held = serde_json::Map::new();
        for id in self.markets.keys() {
            books.insert(id.clone(), serde_json::to_value(self.get_book(id.clone())).unwrap());
            if let Some(a) = &account {
                for yes in [true, false] {
                    let n = self.shares.get(&(id.clone(), a.clone(), yes)).copied().unwrap_or(0);
                    if n > 0 {
                        held.insert(token_id(id, yes), json!(n));
                    }
                }
            }
        }
        json!({
            "markets": self.markets.values().collect::<Vec<_>>(),
            "books": books,
            "trades": self.trades,
            "held": held,
            "orders": account.as_ref().map(|a| self.account_orders(a.clone())).unwrap_or_default(),
            "cash": account.map(|a| self.cash_balance(a).0.to_string()).unwrap_or_else(|| "0".into()),
            "now_ns": env::block_timestamp().to_string(),
        })
    }

    // ---------------------------------------------------------------- NEP-245

    /// Each market has `<market-id>:YES` and `<market-id>:NO` shares.
    pub fn mt_token(&self, token_ids: Vec<String>) -> Vec<Option<Token>> {
        token_ids
            .into_iter()
            .map(|token_id| parse_token(&token_id).filter(|(id, _)| self.markets.contains_key(id)).map(|_| Token { token_id, owner_id: None }))
            .collect()
    }
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        parse_token(&token_id)
            .and_then(|(id, yes)| self.shares.get(&(id, account_id.to_string(), yes)).copied())
            .map_or(U128(0), |n| U128(n as u128))
    }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|id| self.mt_balance_of(account_id.clone(), id)).collect()
    }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> {
        let (id, yes) = parse_token(&token_id)?;
        let m = self.markets.get(&id)?;
        Some(U128(if yes { m.yes - m.burned_yes } else { m.no - m.burned_no } as u128))
    }
    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<U128>> {
        token_ids.into_iter().map(|id| self.mt_supply(id)).collect()
    }

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        require!(approval.is_none(), "ERR_APPROVAL_UNSUPPORTED");
        self.transfer_shares(env::predecessor_account_id(), receiver_id, token_id, amount, memo);
    }
}

impl Kotoba {
    fn trading(&self, id: &str) {
        let m = self.markets.get(id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Open && !m.pending && env::block_timestamp() < m.close_ns, "ERR_CLOSED");
    }

    /// Resting orders that cross `taker`, best first: price (from the taker's side), then age.
    fn crossing(&self, taker: &Order) -> Vec<Candidate> {
        let mut out: Vec<Candidate> = self
            .orders
            .values()
            .filter(|o| o.market_id == taker.market_id)
            .filter_map(|o| {
                let complementary = if o.yes == taker.yes && o.buy != taker.buy {
                    false
                } else if o.yes != taker.yes && o.buy == taker.buy {
                    true
                } else {
                    return None;
                };
                let effective = if complementary { 100 - o.price } else { o.price };
                let crosses = if taker.buy { effective <= taker.price } else { effective >= taker.price };
                crosses.then(|| Candidate { order: o.clone(), effective, complementary })
            })
            .collect();
        out.sort_by(|a, b| {
            let by_price = if taker.buy { a.effective.cmp(&b.effective) } else { b.effective.cmp(&a.effective) };
            by_price.then(a.order.order_id.cmp(&b.order.order_id))
        });
        out
    }

    fn credit(&mut self, owner: &str, amount: u128) {
        if amount == 0 {
            return;
        }
        require!(self.cash.len() < MAX_ACCOUNTS || self.cash.contains_key(owner), "ERR_ACCOUNT_CAP");
        let n = self.cash.get(owner).copied().unwrap_or(0).checked_add(amount).expect("ERR_OVERFLOW");
        self.cash.insert(owner.to_string(), n);
    }

    fn debit(&mut self, owner: &str, amount: u128) {
        if amount == 0 {
            return;
        }
        let n = self.cash.get(owner).copied().unwrap_or(0);
        require!(n >= amount, "ERR_CASH");
        if n == amount {
            self.cash.remove(owner);
        } else {
            self.cash.insert(owner.to_string(), n - amount);
        }
    }

    fn add_shares(&mut self, id: &str, owner: &str, yes: bool, qty: u32) {
        let k = (id.to_string(), owner.to_string(), yes);
        let n = self.shares.get(&k).copied().unwrap_or(0).checked_add(qty).expect("ERR_OVERFLOW");
        self.shares.insert(k, n);
    }

    fn take_shares(&mut self, id: &str, owner: &str, yes: bool, qty: u32) {
        let k = (id.to_string(), owner.to_string(), yes);
        let n = self.shares.get(&k).copied().unwrap_or(0);
        require!(n >= qty, "ERR_INSUFFICIENT_SHARES");
        if n == qty {
            self.shares.remove(&k);
        } else {
            self.shares.insert(k, n - qty);
        }
    }

    /// Returns an order's unfilled escrow to its owner.
    fn release(&mut self, o: &Order) {
        if o.buy {
            self.credit(&o.owner, cents(o.price, o.remaining));
        } else {
            self.add_shares(&o.market_id, &o.owner, o.yes, o.remaining);
        }
    }

    fn transfer_shares(&mut self, sender: AccountId, receiver: AccountId, token: String, amount: U128, memo: Option<String>) {
        require!(sender != receiver, "ERR_SELF_TRANSFER");
        let (id, yes) = parse_token(&token).expect("ERR_TOKEN_ID");
        require!(self.markets.contains_key(&id), "ERR_UNKNOWN_MARKET");
        require!(amount.0 > 0 && amount.0 <= u32::MAX as u128, "ERR_AMOUNT");
        let qty = amount.0 as u32;
        self.take_shares(&id, sender.as_str(), yes, qty);
        self.add_shares(&id, receiver.as_str(), yes, qty);
        mt_event("mt_transfer", json!({"old_owner_id": sender, "new_owner_id": receiver, "token_ids": [token], "amounts": [amount.0.to_string()], "memo": memo}));
    }

    fn request(&self, id: String, challenged: bool, deposit: NearToken) -> Promise {
        let m = self.markets.get(&id).unwrap();
        let args = json!({
            "source": {"WasmUrl": {"url": self.wasm_url, "hash": self.wasm_hash, "build_target": "wasm32-wasip2"}},
            "input_data": json!({"source_url": m.source_url, "phrase": m.phrase, "code_hash": self.wasm_hash}).to_string(),
            "resource_limits": {"max_instructions": 50_000_000_000u64, "max_memory_mb": 256, "max_execution_seconds": 90},
            "response_format": "Json"
        });
        Promise::new(OUTLAYER.parse().unwrap())
            .function_call("request_execution", args.to_string().into_bytes(), deposit, Gas::from_tgas(100))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(30)).on_result(id, challenged))
    }
}

fn cents(price: u32, quantity: u32) -> u128 {
    price as u128 * CENT * quantity as u128
}
fn is_sha256(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}
fn valid_id(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn valid_source(s: &str) -> bool {
    let prefix = "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf";
    s.strip_prefix(prefix)
        .and_then(|tail| tail.strip_suffix(".pdf"))
        .is_some_and(|date| date.len() == 8 && date.bytes().all(|b| b.is_ascii_digit()))
}
fn valid_phrase(s: &str) -> bool {
    !s.is_empty() && s.len() <= 40 && s.split(' ').all(|word| !word.is_empty() && word.bytes().all(|b| b.is_ascii_alphabetic()))
}
fn token_id(id: &str, yes: bool) -> String {
    format!("{id}:{}", if yes { "YES" } else { "NO" })
}
fn parse_token(token: &str) -> Option<(String, bool)> {
    let (id, side) = token.rsplit_once(':')?;
    if !valid_id(id) {
        return None;
    }
    Some((id.to_string(), match side { "YES" => true, "NO" => false, _ => return None }))
}
fn mt_event(event: &str, data: Value) {
    env::log_str(&format!("EVENT_JSON:{}", json!({"standard": "nep245", "version": "1.0.0", "event": event, "data": [data]})));
}
fn refund_bond(m: &mut Market, challenged: bool) {
    let payer = if challenged { m.challenger.take() } else { m.resolver.take() };
    if let Some(account) = payer {
        Promise::new(account.parse().unwrap()).transfer(NearToken::from_yoctonear(BOND)).detach();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, PromiseResult};

    const OP: &str = "book.testnet";
    const ID: &str = "fed-2026-12-09-tariff";

    fn ctx(who: &str, deposit: u128) {
        let mut c = VMContextBuilder::new();
        c.current_account_id(OP.parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_000);
        testing_env!(c.build());
    }

    fn setup() -> Kotoba {
        ctx(OP, 0);
        let mut k = Kotoba::new("https://test.fastfs.io/pinned.wasm".into(), "b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314".into(), 900_000_000_000);
        k.create_market(ID.into(), "fed-2026-12-09".into(), "What will Warsh say?".into(), "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261209.pdf".into(), "tariff".into(), 1, 10_000_000, 20_000_000);
        k
    }

    fn order(k: &mut Kotoba, who: &str, yes: bool, buy: bool, price: u32, qty: u32, kind: &str) -> Order {
        let escrow = if buy { cents(price, qty) } else { 0 };
        ctx(who, ORDER_FEE + escrow);
        k.place_order(ID.into(), yes, buy, price, qty, kind.into())
    }

    fn mint(k: &mut Kotoba, who: &str, qty: u32) {
        ctx(who, ORDER_FEE + qty as u128 * UNIT);
        k.mint_pairs(ID.into(), qty);
    }

    fn held(k: &Kotoba, who: &str, yes: bool) -> u32 {
        k.shares.get(&(ID.to_string(), who.to_string(), yes)).copied().unwrap_or(0)
    }

    fn cash(k: &Kotoba, who: &str) -> u128 {
        k.cash.get(who).copied().unwrap_or(0)
    }

    /// Everything the contract owes (cash, buy escrow, outstanding pairs) must equal what came in.
    fn assert_solvent(k: &Kotoba, deposited: u128) {
        let cash: u128 = k.cash.values().sum();
        let escrow: u128 = k.orders.values().filter(|o| o.buy).map(|o| cents(o.price, o.remaining)).sum();
        let m = &k.markets[ID];
        let yes_out = (m.yes - m.burned_yes) as u128;
        let no_out = (m.no - m.burned_no) as u128;
        assert_eq!(yes_out, no_out, "outstanding YES and NO must stay paired before resolution");
        let held_yes: u128 = k.shares.iter().filter(|((_, _, y), _)| *y).map(|(_, n)| *n as u128).sum();
        let resting_yes: u128 = k.orders.values().filter(|o| o.yes && !o.buy).map(|o| o.remaining as u128).sum();
        assert_eq!(held_yes + resting_yes, yes_out, "every YES share is held or escrowed");
        assert_eq!(cash + escrow + yes_out * UNIT, deposited, "liabilities must equal deposits");
    }

    #[test]
    fn only_the_operator_lists_markets() {
        let mut k = setup();
        ctx("alice.testnet", 0);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            k.create_market("x".into(), "e".into(), "E".into(), "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261209.pdf".into(), "ai".into(), 1, 10_000_000, 20_000_000)
        }));
        assert!(r.is_err());
    }

    #[test]
    fn two_bids_mint_a_pair_at_the_makers_price() {
        let mut k = setup();
        // Bob bids 40c for NO. Alice bids 65c for YES: the NO bid is a YES ask at 60c, so she fills at 60c.
        order(&mut k, "bob.testnet", false, true, 40, 5, "limit");
        let a = order(&mut k, "alice.testnet", true, true, 65, 3, "limit");
        assert_eq!(a.remaining, 0);
        assert_eq!(held(&k, "alice.testnet", true), 3);
        assert_eq!(held(&k, "bob.testnet", false), 3);
        assert_eq!(cash(&k, "alice.testnet"), cents(5, 3)); // price improvement 65 -> 60
        assert_eq!(k.trades[0].kind, "mint");
        assert_eq!(k.trades[0].price, 60);
        assert_eq!(k.trades[0].yes_price, 60);
        let m = &k.markets[ID];
        assert_eq!((m.yes, m.no), (3, 3));
        let book = k.get_book(ID.into());
        assert_eq!(book.asks, vec![Level { price: 60, shares: 2, orders: 1 }]);
        assert_solvent(&k, cents(40, 5) + cents(65, 3));
    }

    #[test]
    fn two_asks_merge_a_pair_and_split_its_payout() {
        let mut k = setup();
        mint(&mut k, "alice.testnet", 4);
        mint(&mut k, "bob.testnet", 4);
        // Alice asks 30c for NO, which is a YES bid at 70c. Bob sells YES at 65c and receives 70c.
        order(&mut k, "alice.testnet", false, false, 30, 4, "limit");
        let b = order(&mut k, "bob.testnet", true, false, 65, 2, "limit");
        assert_eq!(b.remaining, 0);
        assert_eq!(cash(&k, "bob.testnet"), cents(70, 2));
        assert_eq!(cash(&k, "alice.testnet"), cents(30, 2));
        assert_eq!(k.trades[0].kind, "merge");
        let m = &k.markets[ID];
        assert_eq!((m.burned_yes, m.burned_no), (2, 2));
        assert_solvent(&k, 8 * UNIT);
    }

    #[test]
    fn price_then_time_priority_across_both_shares() {
        let mut k = setup();
        mint(&mut k, "carol.testnet", 10);
        order(&mut k, "carol.testnet", true, false, 58, 2, "limit"); // YES ask 58, oldest
        order(&mut k, "bob.testnet", false, true, 42, 2, "limit"); // YES ask 58 via NO bid, newer
        order(&mut k, "dan.testnet", false, true, 45, 2, "limit"); // YES ask 55 via NO bid, best price
        let t = order(&mut k, "alice.testnet", true, true, 60, 5, "limit");
        assert_eq!(t.remaining, 0);
        let fills: Vec<(String, u32, u32)> = k.trades.iter().map(|t| (t.maker.clone(), t.price, t.quantity)).collect();
        assert_eq!(fills, vec![("dan.testnet".into(), 55, 2), ("carol.testnet".into(), 58, 2), ("bob.testnet".into(), 58, 1)]);
        assert_eq!(cash(&k, "alice.testnet"), cents(5, 2) + cents(2, 3));
        assert_solvent(&k, 10 * UNIT + cents(42, 2) + cents(45, 2) + cents(60, 5));
    }

    #[test]
    fn market_orders_return_the_unfilled_rest() {
        let mut k = setup();
        order(&mut k, "bob.testnet", false, true, 40, 2, "limit");
        let t = order(&mut k, "alice.testnet", true, true, 70, 5, "market");
        assert!(t.cancelled);
        assert_eq!(held(&k, "alice.testnet", true), 2);
        assert_eq!(cash(&k, "alice.testnet"), cents(70, 5) - cents(60, 2));
        assert!(k.orders.is_empty());
        assert_solvent(&k, cents(40, 2) + cents(70, 5));
    }

    #[test]
    #[should_panic(expected = "ERR_SELF_CROSS")]
    fn crossing_your_own_order_is_refused() {
        let mut k = setup();
        order(&mut k, "alice.testnet", false, true, 40, 2, "limit");
        order(&mut k, "alice.testnet", true, true, 60, 1, "limit");
    }

    #[test]
    #[should_panic(expected = "ERR_ORDER_OWNER")]
    fn nobody_cancels_someone_elses_order() {
        let mut k = setup();
        let o = order(&mut k, "alice.testnet", true, true, 30, 2, "limit");
        ctx("mallory.testnet", 1);
        k.cancel_order(o.order_id);
    }

    #[test]
    #[should_panic(expected = "ERR_INSUFFICIENT_SHARES")]
    fn selling_shares_you_do_not_have_is_refused() {
        let mut k = setup();
        mint(&mut k, "alice.testnet", 1);
        order(&mut k, "alice.testnet", true, false, 50, 2, "limit");
    }

    #[test]
    #[should_panic(expected = "ERR_CASH")]
    fn underfunded_bids_are_refused() {
        let mut k = setup();
        ctx("alice.testnet", ORDER_FEE + cents(50, 2) - 1);
        k.place_order(ID.into(), true, true, 50, 2, "limit".into());
    }

    #[test]
    fn cancel_returns_escrow_and_removes_the_order() {
        let mut k = setup();
        let o = order(&mut k, "alice.testnet", false, true, 30, 4, "limit");
        ctx("alice.testnet", 1);
        k.cancel_order(o.order_id);
        assert_eq!(cash(&k, "alice.testnet"), cents(30, 4));
        assert!(k.orders.is_empty());
        ctx("alice.testnet", 1);
        let again = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| k.cancel_order(o.order_id)));
        assert!(again.is_err());
    }

    /// A long pseudo-random session of mints, bids, asks, market orders, cancels and redemptions keeps
    /// every share paired and every yoctoNEAR accounted for.
    #[test]
    fn random_sessions_stay_solvent() {
        let mut k = setup();
        let people = ["a.testnet", "b.testnet", "c.testnet", "d.testnet", "e.testnet", "f.testnet", "g.testnet", "h.testnet"];
        let mut seed: u64 = 0x5eed;
        let mut next = |n: u64| {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (seed >> 33) % n
        };
        let mut deposited = 0u128;
        for _ in 0..2500 {
            let who = people[next(8) as usize];
            let roll = next(10);
            let yes = next(2) == 0;
            let price = 1 + next(99) as u32;
            let qty = 1 + next(6) as u32;
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let mut copy = k.clone_state();
                let added = match roll {
                    0 => { ctx(who, ORDER_FEE + qty as u128 * UNIT); copy.mint_pairs(ID.into(), qty); qty as u128 * UNIT }
                    1..=4 => { ctx(who, ORDER_FEE + cents(price, qty)); copy.place_order(ID.into(), yes, true, price, qty, if roll == 4 { "market" } else { "limit" }.into()); cents(price, qty) }
                    5..=7 => { ctx(who, ORDER_FEE); copy.place_order(ID.into(), yes, false, price, qty, if roll == 7 { "market" } else { "limit" }.into()); 0 }
                    8 => { let id = copy.orders.values().find(|o| o.owner == who).map(|o| o.order_id).unwrap_or(0); ctx(who, 1); copy.cancel_order(id); 0 }
                    _ => { ctx(who, 1); copy.redeem_pairs(ID.into(), 1); 0 }
                };
                (copy, added)
            }));
            // A refused call changes nothing (the runtime reverts it), so only successful calls are kept.
            if let Ok((copy, added)) = r {
                k = copy;
                deposited += added;
                assert_solvent(&k, deposited);
            }
        }
        assert!(k.trades.len() > 80, "the session should produce many fills, got {}", k.trades.len());
        assert!(k.trades.iter().any(|t| t.kind == "mint") && k.trades.iter().any(|t| t.kind == "merge") && k.trades.iter().any(|t| t.kind == "swap"));
    }

    #[test]
    fn failed_withdrawal_is_recredited_without_losing_concurrent_credit() {
        let mut c = VMContextBuilder::new();
        c.current_account_id(OP.parse().unwrap()).predecessor_account_id(OP.parse().unwrap());
        testing_env!(c.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![PromiseResult::Failed]);
        let mut k = Kotoba::new("https://test.fastfs.io/pinned.wasm".into(), "b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314".into(), 900_000_000_000);
        k.cash.insert("t.testnet".into(), 17);
        k.withdrawals.insert("t.testnet".into(), 30);
        assert!(!k.on_book_withdraw("t.testnet".into(), U128(30)));
        assert_eq!(k.cash["t.testnet"], 47);
        let replay = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| k.on_book_withdraw("t.testnet".into(), U128(30))));
        assert!(replay.is_err());
    }

    impl Kotoba {
        fn clone_state(&self) -> Kotoba {
            Kotoba::try_from_slice(&near_sdk::borsh::to_vec(self).unwrap()).unwrap()
        }
    }
}
