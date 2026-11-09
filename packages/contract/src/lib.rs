use near_sdk::borsh::{BorshDeserialize, BorshSerialize, BorshSchema};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use std::collections::BTreeMap;

const UNIT: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const FEE_BPS: u128 = 100; // 1% of the rounded LMSR cost, paid to the market creator
const MIN_WINDOW_NS: u64 = 10 * 60 * 1_000_000_000; // a challenge window is at least 10 minutes
const BOND: u128 = 100 * UNIT; // 0.1 NEAR resolver or challenger bond
const OUTLAYER: &str = "outlayer.testnet";

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Market {
    pub id: String,
    pub event: String,
    pub source_url: String,
    pub phrase: String,
    pub threshold: u32,
    pub close_ns: u64,
    pub deadline_ns: u64,
    pub b: u32,
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

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum Status { Open, Provisional, Final }

#[derive(BorshDeserialize, BorshSerialize, BorshSchema, Serialize, Deserialize, schemars::JsonSchema, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct OracleOutput {
    pub count: u32,
    pub transcript_sha256: String,
    pub source_url: String,
    pub code_hash: String,
    #[serde(default)]
    pub attestation: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Kotoba {
    markets: BTreeMap<String, Market>,
    shares: BTreeMap<(String, String, bool), u32>,
    wasm_url: String,
    wasm_hash: String,
    challenge_window_ns: u64,
}

#[derive(Serialize, schemars::JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct Token { token_id: String, owner_id: Option<String> }

#[near]
impl Kotoba {
    #[init]
    pub fn new(wasm_url: String, wasm_hash: String, challenge_window_ns: u64) -> Self {
        require!(wasm_url.starts_with("https://"), "ERR_WASM_URL");
        // OutLayer refuses an uppercase hash, so a mixed-case pin could never resolve.
        require!(is_sha256(&wasm_hash) && wasm_hash.bytes().all(|b| !b.is_ascii_uppercase()), "ERR_WASM_HASH");
        require!(challenge_window_ns >= MIN_WINDOW_NS, "ERR_WINDOW");
        Self { markets: BTreeMap::new(), shares: BTreeMap::new(), wasm_url, wasm_hash, challenge_window_ns }
    }

    /// The pinned oracle program and the challenge window every market uses.
    pub fn config(&self) -> (String, String, u64) { (self.wasm_url.clone(), self.wasm_hash.clone(), self.challenge_window_ns) }

    #[payable]
    pub fn create_market(&mut self, id: String, event: String, source_url: String, phrase: String, threshold: u32, close_ns: u64, deadline_ns: u64, b: u32) {
        require!(valid_id(&id) && !self.markets.contains_key(&id), "ERR_MARKET_ID");
        require!(valid_source(&source_url), "ERR_SOURCE");
        require!(!event.is_empty() && event.len() <= 120, "ERR_EVENT");
        require!(valid_phrase(&phrase), "ERR_PHRASE");
        require!(threshold > 0 && b >= 100 && b <= 100_000, "ERR_PARAMETERS");
        require!(close_ns > env::block_timestamp() && deadline_ns > close_ns, "ERR_TIME");
        // C(0,0)=b*ln(2); this bounds the AMM's worst-case subsidy.
        let seed = ((b as f64 * std::f64::consts::LN_2).ceil() as u128) * UNIT;
        require!(env::attached_deposit().as_yoctonear() >= seed, "ERR_SUBSIDY");
        let excess = env::attached_deposit().as_yoctonear() - seed;
        if excess > 0 { Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(excess)).detach(); }
        self.markets.insert(id.clone(), Market { id, event, source_url, phrase: phrase.to_ascii_lowercase(), threshold, close_ns, deadline_ns, b, yes: 0, no: 0, burned_yes: 0, burned_no: 0, creator: env::predecessor_account_id().to_string(), status: Status::Open, result: None, challenge_until_ns: None, pending: false, resolver: None, challenger: None });
    }

    #[payable]
    pub fn buy(&mut self, id: String, yes: bool, quantity: u32) -> U128 {
        let mut market = self.markets.get(&id).expect("ERR_UNKNOWN_MARKET").clone();
        require!(market.status == Status::Open && env::block_timestamp() < market.close_ns, "ERR_CLOSED");
        require!(quantity > 0 && quantity <= 100_000, "ERR_QUANTITY");
        let before = cost(market.yes, market.no, market.b);
        if yes { market.yes = market.yes.checked_add(quantity).expect("ERR_OVERFLOW"); }
        else { market.no = market.no.checked_add(quantity).expect("ERR_OVERFLOW"); }
        let base = ((cost(market.yes, market.no, market.b) - before).ceil() as u128) * UNIT;
        let amount = with_fee(base);
        require!(amount > 0 && env::attached_deposit().as_yoctonear() >= amount, "ERR_DEPOSIT");
        let key = (id.clone(), env::predecessor_account_id().to_string(), yes);
        *self.shares.entry(key).or_default() += quantity;
        mt_event("mt_mint", near_sdk::serde_json::json!({"owner_id":env::predecessor_account_id(),"token_ids":[token_id(&id, yes)],"amounts":[quantity.to_string()]}));
        let creator: AccountId = market.creator.parse().expect("ERR_CREATOR");
        self.markets.insert(id, market);
        Promise::new(creator).transfer(NearToken::from_yoctonear(amount - base)).detach();
        let excess = env::attached_deposit().as_yoctonear() - amount;
        if excess > 0 { Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(excess)).detach(); }
        U128(amount)
    }

    pub fn quote(&self, id: String, yes: bool, quantity: u32) -> U128 {
        let m = self.markets.get(&id).expect("ERR_UNKNOWN_MARKET");
        require!(quantity > 0 && quantity <= 100_000, "ERR_QUANTITY");
        let before = cost(m.yes, m.no, m.b);
        let after = if yes { cost(m.yes + quantity, m.no, m.b) } else { cost(m.yes, m.no + quantity, m.b) };
        U128(with_fee(((after - before).ceil() as u128) * UNIT))
    }

    pub fn prices(&self, id: String) -> (f64, f64) {
        let m = self.markets.get(&id).expect("ERR_UNKNOWN_MARKET");
        let yes = yes_price(m.yes, m.no, m.b);
        (yes, 1.0 - yes)
    }

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
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.pending, "ERR_NOT_PENDING");
        m.pending = false;
        require!(env::promise_results_count() == 1, "ERR_PROMISE_COUNT");
        let Ok(bytes) = env::promise_result_checked(0, 900) else {
            refund_bond(m, challenged);
            env::log_str("OutLayer execution failed; resolution remains open");
            return false;
        };
        let Ok(output) = near_sdk::serde_json::from_slice::<OracleOutput>(&bytes) else {
            refund_bond(m, challenged);
            env::log_str("OutLayer returned invalid oracle JSON; resolution remains open");
            return false;
        };
        if output.source_url != m.source_url || output.code_hash != self.wasm_hash || !is_sha256(&output.transcript_sha256) {
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
        } else {
            m.result = Some(output);
            m.status = Status::Provisional;
        }
        m.challenge_until_ns = Some(env::block_timestamp() + self.challenge_window_ns);
        true
    }

    pub fn finalize(&mut self, id: String) {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Provisional && !m.pending && env::block_timestamp() >= m.challenge_until_ns.unwrap(), "ERR_WINDOW");
        m.status = Status::Final;
        if let Some(account) = m.resolver.take() { Promise::new(account.parse().unwrap()).transfer(NearToken::from_yoctonear(BOND)).detach(); }
    }

    pub fn claim(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Final, "ERR_NOT_FINAL");
        let account = env::predecessor_account_id();
        let winning_yes = m.result.as_ref().unwrap().count >= m.threshold;
        let key = (id.clone(), account.to_string(), winning_yes);
        let qty = self.shares.get(&key).copied().unwrap_or(0);
        require!(qty > 0, "ERR_NO_WINNING_SHARES");
        self.shares.remove(&key);
        if winning_yes { m.burned_yes += qty; } else { m.burned_no += qty; }
        mt_event("mt_burn", near_sdk::serde_json::json!({"owner_id":account,"token_ids":[token_id(&id, winning_yes)],"amounts":[qty.to_string()]}));
        Promise::new(account).transfer(NearToken::from_yoctonear(qty as u128 * UNIT))
    }

    /// If no attested result settled the market by its deadline, every share redeems for half a unit.
    /// Solvent: escrow = b·ln2 + C(q) − C(0) ≥ max(yes, no) ≥ (yes + no) / 2.
    pub fn claim_void(&mut self, id: String) -> Promise {
        let m = self.markets.get_mut(&id).expect("ERR_UNKNOWN_MARKET");
        require!(m.status == Status::Open && !m.pending && env::block_timestamp() > m.deadline_ns, "ERR_NOT_VOID");
        let account = env::predecessor_account_id();
        let yes = self.shares.remove(&(id.clone(), account.to_string(), true)).unwrap_or(0);
        let no = self.shares.remove(&(id.clone(), account.to_string(), false)).unwrap_or(0);
        require!(yes + no > 0, "ERR_NO_SHARES");
        m.burned_yes += yes;
        m.burned_no += no;
        for (qty, side) in [(yes, true), (no, false)] {
            if qty > 0 { mt_event("mt_burn", near_sdk::serde_json::json!({"owner_id":account,"token_ids":[token_id(&id, side)],"amounts":[qty.to_string()]})); }
        }
        Promise::new(account).transfer(NearToken::from_yoctonear((yes + no) as u128 * UNIT / 2))
    }

    /// NEP-245 core views. Each market has `<market-id>:YES` and `<market-id>:NO` shares.
    pub fn mt_token(&self, token_ids: Vec<String>) -> Vec<Option<Token>> {
        token_ids.into_iter().map(|token_id| parse_token(&token_id).filter(|(id, _)| self.markets.contains_key(id)).map(|_| Token { token_id, owner_id: None })).collect()
    }
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        parse_token(&token_id).and_then(|(id, yes)| self.shares.get(&(id, account_id.to_string(), yes)).copied()).map_or(U128(0), |n| U128(n as u128))
    }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|id| self.mt_balance_of(account_id.clone(), id)).collect()
    }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> {
        let (id, yes) = parse_token(&token_id)?;
        let m = self.markets.get(&id)?;
        Some(U128(if yes { m.yes - m.burned_yes } else { m.no - m.burned_no } as u128))
    }
    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<U128>> { token_ids.into_iter().map(|id| self.mt_supply(id)).collect() }

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        require!(approval.is_none(), "ERR_APPROVAL_UNSUPPORTED");
        let sender = env::predecessor_account_id();
        self.transfer_shares(sender, receiver_id, token_id, amount, memo);
    }

    #[payable]
    pub fn mt_batch_transfer(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, approvals: Option<Vec<Option<(AccountId, u64)>>>, memo: Option<String>) {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        require!(!token_ids.is_empty() && token_ids.len() == amounts.len(), "ERR_BATCH_LENGTH");
        require!(approvals.is_none(), "ERR_APPROVAL_UNSUPPORTED");
        let sender = env::predecessor_account_id();
        for (id, amount) in token_ids.into_iter().zip(amounts) { self.transfer_shares(sender.clone(), receiver_id.clone(), id, amount, memo.clone()); }
    }

    #[payable]
    pub fn mt_transfer_call(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>, msg: String) -> Promise {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        require!(approval.is_none(), "ERR_APPROVAL_UNSUPPORTED");
        let sender = env::predecessor_account_id();
        self.transfer_shares(sender.clone(), receiver_id.clone(), token_id.clone(), amount, memo);
        self.call_receiver(sender, receiver_id, vec![token_id], vec![amount], msg)
    }

    #[payable]
    pub fn mt_batch_transfer_call(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, approvals: Option<Vec<Option<(AccountId, u64)>>>, memo: Option<String>, msg: String) -> Promise {
        require!(env::attached_deposit().as_yoctonear() == 1, "ERR_ONE_YOCTO");
        require!(!token_ids.is_empty() && token_ids.len() == amounts.len(), "ERR_BATCH_LENGTH");
        require!(approvals.is_none(), "ERR_APPROVAL_UNSUPPORTED");
        let sender = env::predecessor_account_id();
        for (token, amount) in token_ids.iter().zip(amounts.iter()) { self.transfer_shares(sender.clone(), receiver_id.clone(), token.clone(), *amount, memo.clone()); }
        self.call_receiver(sender, receiver_id, token_ids, amounts, msg)
    }

    #[private]
    pub fn mt_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>) -> Vec<U128> {
        require!(env::promise_results_count() == 1, "ERR_PROMISE_COUNT");
        let unused: Vec<U128> = env::promise_result_checked(0, 4096).ok().and_then(|bytes| near_sdk::serde_json::from_slice(&bytes).ok()).filter(|values: &Vec<U128>| values.len() == token_ids.len()).unwrap_or_else(|| amounts.clone());
        token_ids.into_iter().zip(amounts).zip(unused).map(|((token, sent), unused)| {
            let (id, yes) = parse_token(&token).expect("ERR_TOKEN_ID");
            let available = self.shares.get(&(id, receiver_id.to_string(), yes)).copied().unwrap_or(0) as u128;
            let refund = unused.0.min(sent.0).min(available);
            if refund > 0 { self.transfer_shares(receiver_id.clone(), sender_id.clone(), token, U128(refund), None); }
            U128(sent.0 - refund)
        }).collect()
    }

    pub fn get_market(&self, id: String) -> Option<Market> { self.markets.get(&id).cloned() }
    pub fn list_markets(&self) -> Vec<Market> { self.markets.values().cloned().collect() }
    pub fn balance_of(&self, id: String, account: AccountId, yes: bool) -> u32 { self.shares.get(&(id, account.to_string(), yes)).copied().unwrap_or(0) }
}

impl Kotoba {
    fn call_receiver(&self, sender: AccountId, receiver: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, msg: String) -> Promise {
        let args = near_sdk::serde_json::json!({"sender_id":sender,"previous_owner_ids":vec![sender.to_string();token_ids.len()],"token_ids":token_ids,"amounts":amounts,"msg":msg});
        Promise::new(receiver.clone()).function_call("mt_on_transfer", args.to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(35))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(30)).mt_resolve_transfer(sender, receiver, token_ids, amounts))
    }
    fn transfer_shares(&mut self, sender: AccountId, receiver: AccountId, token: String, amount: U128, memo: Option<String>) {
        require!(sender != receiver, "ERR_SELF_TRANSFER");
        let (id, yes) = parse_token(&token).expect("ERR_TOKEN_ID");
        require!(self.markets.contains_key(&id), "ERR_UNKNOWN_MARKET");
        require!(amount.0 > 0 && amount.0 <= u32::MAX as u128, "ERR_AMOUNT");
        let qty = amount.0 as u32;
        let from = (id.clone(), sender.to_string(), yes);
        let balance = self.shares.get(&from).copied().unwrap_or(0);
        require!(balance >= qty, "ERR_INSUFFICIENT_SHARES");
        if balance == qty { self.shares.remove(&from); } else { self.shares.insert(from, balance - qty); }
        let to = (id, receiver.to_string(), yes);
        let new_balance = self.shares.get(&to).copied().unwrap_or(0).checked_add(qty).expect("ERR_OVERFLOW");
        self.shares.insert(to, new_balance);
        mt_event("mt_transfer", near_sdk::serde_json::json!({"old_owner_id":sender,"new_owner_id":receiver,"token_ids":[token],"amounts":[amount.0.to_string()],"memo":memo}));
    }
    fn request(&self, id: String, challenged: bool, deposit: NearToken) -> Promise {
        let m = self.markets.get(&id).unwrap();
        let args = near_sdk::serde_json::json!({
            "source": {"WasmUrl": {"url": self.wasm_url, "hash": self.wasm_hash, "build_target": "wasm32-wasip2"}},
            "input_data": near_sdk::serde_json::json!({"source_url":m.source_url,"phrase":m.phrase,"code_hash":self.wasm_hash}).to_string(),
            "resource_limits": {"max_instructions":50_000_000_000u64,"max_memory_mb":256,"max_execution_seconds":90},
            "response_format":"Json"
        });
        Promise::new(OUTLAYER.parse().unwrap()).function_call("request_execution", args.to_string().into_bytes(), deposit, Gas::from_tgas(100))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(30)).on_result(id, challenged))
    }
}

fn cost(yes: u32, no: u32, b: u32) -> f64 {
    let hi = yes.max(no) as f64 / b as f64;
    let lo = yes.min(no) as f64 / b as f64;
    b as f64 * (hi + (1.0 + (lo - hi).exp()).ln())
}
fn with_fee(base: u128) -> u128 { base + base * FEE_BPS / 10_000 }
fn yes_price(yes: u32, no: u32, b: u32) -> f64 {
    let difference = (yes as f64 - no as f64) / b as f64;
    if difference >= 0.0 { 1.0 / (1.0 + (-difference).exp()) }
    else { let ratio = difference.exp(); ratio / (1.0 + ratio) }
}
fn is_sha256(s: &str) -> bool { s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()) }
fn valid_id(s: &str) -> bool { !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') }
fn valid_source(s: &str) -> bool {
    let prefix = "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf";
    s.strip_prefix(prefix).and_then(|tail| tail.strip_suffix(".pdf"))
        .is_some_and(|date| date.len() == 8 && date.bytes().all(|b| b.is_ascii_digit()))
}
fn valid_phrase(s: &str) -> bool { !s.is_empty() && s.len() <= 40 && s.split(' ').all(|word| !word.is_empty() && word.bytes().all(|b| b.is_ascii_alphabetic())) }
fn token_id(id: &str, yes: bool) -> String { format!("{id}:{}", if yes { "YES" } else { "NO" }) }
fn parse_token(token: &str) -> Option<(String, bool)> {
    let (id, side) = token.rsplit_once(':')?;
    if !valid_id(id) { return None; }
    Some((id.to_string(), match side { "YES" => true, "NO" => false, _ => return None }))
}
fn mt_event(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!("EVENT_JSON:{}", near_sdk::serde_json::json!({"standard":"nep245","version":"1.0.0","event":event,"data":[data]})));
}
fn refund_bond(m: &mut Market, challenged: bool) {
    let payer = if challenged { m.challenger.take() } else { m.resolver.take() };
    if let Some(account) = payer { Promise::new(account.parse().unwrap()).transfer(NearToken::from_yoctonear(BOND)).detach(); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn prices_sum() { for y in [0, 1, 100, 10000] { for n in [0, 2, 100, 30000] { let x=((y as f64-n as f64)/1000.0).exp(); assert!(((x/(1.0+x))+(1.0/(1.0+x))-1.0).abs()<1e-12); } } }
    #[test] fn lmsr_complete_set() { let c=cost(100, 100, 1000)-cost(0,0,1000); assert!((c-100.0).abs()<1e-9); }
    #[test] fn lmsr_monotonic() { assert!(cost(5,0,1000)>cost(0,0,1000)); assert!(cost(10,0,1000)>cost(5,0,1000)); }
    #[test] fn no_risk_free_complete_set() {
        for yes in [0, 1, 10, 100, 10_000] {
            for no in [0, 1, 10, 100, 10_000] {
                let paid = cost(yes, no, 1000) - cost(0, 0, 1000);
                let guaranteed_payout = yes.min(no) as f64;
                assert!(paid + 1e-9 >= guaranteed_payout, "{yes} YES / {no} NO cost {paid} below guaranteed {guaranteed_payout}");
            }
        }
    }
    #[test] fn extreme_prices_are_finite() { for (yes, no) in [(100_000, 0), (0, 100_000)] { let price = yes_price(yes, no, 100); assert!(price.is_finite() && (0.0..=1.0).contains(&price)); } }
}
