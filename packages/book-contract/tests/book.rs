//! Sandbox tests against the real compiled WASM: every path a trader can hit, plus the attacks.
use near_workspaces::network::Sandbox;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract, Worker};
use serde_json::{json, Value};

const U: u128 = 1_000_000_000_000_000_000_000;
const C: u128 = U / 100;
const FEE: u128 = 3 * U;
const ID: &str = "fed-2026-12-09-tariff";
const PDF: &str = "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261209.pdf";

async fn call(who: &Account, c: &Contract, method: &str, args: Value, deposit: u128) -> ExecutionFinalResult {
    who.call(c.id(), method).args_json(args).deposit(NearToken::from_yoctonear(deposit)).gas(Gas::from_tgas(200)).transact().await.unwrap()
}
fn ok(r: ExecutionFinalResult) -> Value {
    r.into_result().unwrap().json().unwrap_or(Value::Null)
}
fn refused(r: ExecutionFinalResult, why: &str) {
    assert!(r.is_failure(), "expected {why}, got success");
    assert!(format!("{r:?}").contains(why), "expected {why}: {r:?}");
}
async fn view(c: &Contract, method: &str, args: Value) -> Value {
    c.view(method).args_json(args).await.unwrap().json().unwrap()
}
async fn order(who: &Account, c: &Contract, yes: bool, buy: bool, price: u32, qty: u32, kind: &str) -> Value {
    let escrow = if buy { price as u128 * qty as u128 * C } else { 0 };
    ok(call(who, c, "place_order", json!({"id": ID, "yes": yes, "buy": buy, "price": price, "quantity": qty, "kind": kind}), FEE + escrow).await)
}
async fn held(c: &Contract, who: &Account, yes: bool) -> u64 {
    view(c, "balance_of", json!({"id": ID, "account": who.id(), "yes": yes})).await.as_u64().unwrap()
}
async fn cash(c: &Contract, who: &Account) -> u128 {
    view(c, "cash_balance", json!({"account": who.id()})).await.as_str().unwrap().parse().unwrap()
}

async fn setup() -> (Worker<Sandbox>, Contract, Account, Account, Account) {
    let w = near_workspaces::sandbox().await.unwrap();
    let wasm = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../contract/target/near/kotoba_book.wasm")).unwrap();
    let c = w.dev_deploy(&wasm).await.unwrap();
    ok(call(c.as_account(), &c, "new", json!({"wasm_url": "https://test.fastfs.io/pinned.wasm", "wasm_hash": "b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314", "challenge_window_ns": 900_000_000_000u64}), 0).await);
    let now = w.view_block().await.unwrap().timestamp();
    let a = w.dev_create_account().await.unwrap();
    let b = w.dev_create_account().await.unwrap();
    let d = w.dev_create_account().await.unwrap();
    let market = json!({"id": ID, "event_id": "fed-2026-12-09", "event": "What will Warsh say?", "source_url": PDF, "phrase": "tariff", "threshold": 1, "close_ns": now + 120_000_000_000u64, "deadline_ns": now + 86_400_000_000_000u64});
    refused(call(&a, &c, "create_market", market.clone(), 0).await, "ERR_OPERATOR_ONLY");
    ok(call(c.as_account(), &c, "create_market", market, 0).await);
    (w, c, a, b, d)
}

#[tokio::test]
async fn bids_on_both_shares_mint_and_the_book_mirrors_no_orders() {
    let (_w, c, a, b, _) = setup().await;
    order(&b, &c, false, true, 38, 4, "limit").await; // NO bid 38c = YES ask 62c
    order(&b, &c, false, true, 35, 3, "limit").await; // YES ask 65c
    let book = view(&c, "get_book", json!({"id": ID})).await;
    assert_eq!(book["asks"][0], json!({"price": 62, "shares": 4, "orders": 1}));
    assert_eq!(book["asks"][1]["price"], 65);
    let fill = order(&a, &c, true, true, 64, 5, "limit").await; // takes 4 at 62, rests 1 at 64
    assert_eq!(fill["remaining"], 1);
    assert_eq!(held(&c, &a, true).await, 4);
    assert_eq!(held(&c, &b, false).await, 4);
    let trades = view(&c, "trade_history", json!({"id": ID})).await;
    assert_eq!(trades[0]["kind"], "mint");
    assert_eq!(trades[0]["yes_price"], 62);
    let book = view(&c, "get_book", json!({"id": ID})).await;
    assert_eq!(book["bids"][0], json!({"price": 64, "shares": 1, "orders": 1}));
    assert_eq!(book["spread"], 1);
    assert_eq!(book["last_yes_price"], 62);
    let market = view(&c, "get_market", json!({"id": ID})).await;
    assert_eq!((market["yes"].as_u64(), market["no"].as_u64()), (Some(4), Some(4)));
}

#[tokio::test]
async fn sell_before_the_event_merge_cancel_and_withdraw() {
    let (_w, c, a, b, _) = setup().await;
    ok(call(&a, &c, "mint_pairs", json!({"id": ID, "quantity": 5}), FEE + 5 * U).await);
    ok(call(&b, &c, "mint_pairs", json!({"id": ID, "quantity": 5}), FEE + 5 * U).await);
    order(&a, &c, false, false, 45, 5, "limit").await; // NO ask 45c = YES bid 55c
    let sold = order(&b, &c, true, false, 50, 3, "market").await; // B sells YES and gets 55c each
    assert_eq!(sold["remaining"], 0);
    assert_eq!(cash(&c, &b).await, 165 * C);
    assert_eq!(cash(&c, &a).await, 135 * C);
    assert_eq!(view(&c, "trade_history", json!({"id": ID})).await[0]["kind"], "merge");
    // A cancels the rest of the NO ask and gets 2 NO shares back; B cannot cancel it.
    let open = view(&c, "account_orders", json!({"account": a.id()})).await;
    let id = open[0]["order_id"].clone();
    refused(call(&b, &c, "cancel_order", json!({"order_id": id}), 1).await, "ERR_ORDER_OWNER");
    ok(call(&a, &c, "cancel_order", json!({"order_id": id}), 1).await);
    assert_eq!(held(&c, &a, false).await, 2);
    refused(call(&a, &c, "cancel_order", json!({"order_id": id}), 1).await, "ERR_ORDER_CLOSED");
    assert_eq!(ok(call(&b, &c, "withdraw", json!({"amount": (165 * C).to_string()}), 1).await), true);
    assert_eq!(cash(&c, &b).await, 0);
}

#[tokio::test]
async fn attacks_are_refused_and_change_nothing() {
    let (w, c, a, b, d) = setup().await;
    ok(call(&a, &c, "mint_pairs", json!({"id": ID, "quantity": 2}), FEE + 2 * U).await);
    for (price, qty, why) in [(0, 1, "ERR_PRICE"), (100, 1, "ERR_PRICE"), (50, 0, "ERR_QUANTITY"), (50, 100_001, "ERR_QUANTITY")] {
        refused(call(&b, &c, "place_order", json!({"id": ID, "yes": true, "buy": true, "price": price, "quantity": qty, "kind": "limit"}), FEE).await, why);
    }
    refused(call(&b, &c, "place_order", json!({"id": ID, "yes": true, "buy": false, "price": 50, "quantity": 1, "kind": "limit"}), FEE).await, "ERR_INSUFFICIENT_SHARES");
    refused(call(&b, &c, "place_order", json!({"id": ID, "yes": true, "buy": true, "price": 50, "quantity": 2, "kind": "limit"}), FEE + 99 * C).await, "ERR_CASH");
    refused(call(&a, &c, "place_order", json!({"id": ID, "yes": true, "buy": false, "price": 50, "quantity": 3, "kind": "limit"}), FEE).await, "ERR_INSUFFICIENT_SHARES");
    refused(call(&b, &c, "on_book_withdraw", json!({"owner": b.id(), "amount": "1"}), 0).await, "private");
    refused(call(&b, &c, "withdraw", json!({"amount": "1"}), 1).await, "ERR_CASH");
    refused(call(&d, &c, "on_result", json!({"id": ID, "challenged": false}), 0).await, "private");
    // Self-crossing is refused; an overfill is impossible because a fill is capped by the resting size.
    order(&a, &c, true, false, 60, 2, "limit").await;
    refused(call(&a, &c, "place_order", json!({"id": ID, "yes": true, "buy": true, "price": 60, "quantity": 1, "kind": "limit"}), FEE + 60 * C).await, "ERR_SELF_CROSS");
    let t = order(&b, &c, true, true, 60, 9, "market").await;
    assert_eq!(t["cancelled"], true);
    assert_eq!(held(&c, &b, true).await, 2);
    assert_eq!(cash(&c, &b).await, 7 * 60 * C);
    assert_eq!(view(&c, "get_book", json!({"id": ID})).await["asks"], json!([]));
    // After close nobody trades, but resting orders can still be cancelled.
    let resting = order(&b, &c, false, true, 10, 1, "limit").await;
    let close = view(&c, "get_market", json!({"id": ID})).await["close_ns"].as_u64().unwrap();
    while w.view_block().await.unwrap().timestamp() < close {
        w.fast_forward(1500).await.unwrap();
    }
    refused(call(&d, &c, "place_order", json!({"id": ID, "yes": true, "buy": true, "price": 50, "quantity": 1, "kind": "limit"}), FEE + 50 * C).await, "ERR_CLOSED");
    refused(call(&d, &c, "mint_pairs", json!({"id": ID, "quantity": 1}), FEE + U).await, "ERR_CLOSED");
    ok(call(&b, &c, "cancel_order", json!({"order_id": resting["order_id"]}), 1).await);
    refused(call(&b, &c, "claim", json!({"id": ID}), 0).await, "ERR_NOT_FINAL");
}

#[tokio::test]
async fn snapshot_is_one_coherent_read() {
    let (_w, c, a, b, _) = setup().await;
    order(&b, &c, false, true, 40, 2, "limit").await;
    order(&a, &c, true, true, 60, 1, "limit").await;
    let snap = view(&c, "snapshot", json!({"account": a.id()})).await;
    assert_eq!(snap["markets"].as_array().unwrap().len(), 1);
    assert_eq!(snap["markets"][0]["event_id"], "fed-2026-12-09");
    assert_eq!(snap["held"][format!("{ID}:YES")], 1);
    assert_eq!(snap["books"][ID]["asks"][0]["price"], 60);
    assert_eq!(snap["trades"].as_array().unwrap().len(), 1);
    assert_eq!(snap["orders"], json!([]));
}
