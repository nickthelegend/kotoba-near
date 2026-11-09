//! Signed transactions against a real local nearcore sandbox. Build the contract WASM first.
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

const WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/target/near/kotoba_contract.wasm");
const ORACLE_WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../oracle/target/wasm32-wasip2/release/kotoba-oracle.wasm");
fn now_ns() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as u64 }
fn rejected(result: near_workspaces::result::ExecutionFinalResult, code: &str) {
    assert!(result.is_failure(), "chain accepted attack: {code}");
    assert!(format!("{result:?}").contains(code), "chain rejected with wrong error: {result:?}");
}

#[tokio::test]
async fn market_and_attacker_guards_on_real_local_chain() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let creator = worker.dev_create_account().await?;
    let player = worker.dev_create_account().await?;
    let contract = creator.deploy(&std::fs::read(WASM)?).await?.into_result()?;
    let oracle_hash = format!("{:x}", Sha256::digest(std::fs::read(ORACLE_WASM)?));
    creator.call(contract.id(), "new").args_json(json!({"wasm_url":format!("https://test.fastfs.io/kotoba-test/{oracle_hash}.wasm"),"wasm_hash":oracle_hash})).transact().await?.into_result()?;
    let close = now_ns() + 3_600_000_000_000;
    let deadline = close + 7 * 86_400_000_000_000;
    creator.call(contract.id(), "create_market").args_json(json!({"id":"fomc-jan-inflation","event":"January 2026 FOMC press conference","source_url":"https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf","phrase":"inflation","threshold":40,"close_ns":close,"deadline_ns":deadline,"b":1000})).deposit(NearToken::from_near(1)).transact().await?.into_result()?;
    rejected(creator.call(contract.id(), "create_market").args_json(json!({"id":"bad-fed-url","event":"Invalid source rejection","source_url":"https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf?swap=1","phrase":"inflation","threshold":1,"close_ns":close,"deadline_ns":deadline,"b":1000})).deposit(NearToken::from_near(1)).transact().await?, "ERR_SOURCE");
    let market: serde_json::Value = contract.view("get_market").args_json(json!({"id":"fomc-jan-inflation"})).await?.json()?;
    assert_eq!(market["status"], "Open");
    let quote: String = contract.view("quote").args_json(json!({"id":"fomc-jan-inflation","yes":true,"quantity":10})).await?.json()?;
    let amount: u128 = quote.parse()?;
    player.call(contract.id(), "buy").args_json(json!({"id":"fomc-jan-inflation","yes":true,"quantity":10})).deposit(NearToken::from_yoctonear(amount)).transact().await?.into_result()?;
    let balance: u32 = contract.view("balance_of").args_json(json!({"id":"fomc-jan-inflation","account":player.id(),"yes":true})).await?.json()?;
    assert_eq!(balance, 10);
    let recipient = worker.dev_create_account().await?;
    rejected(recipient.call(contract.id(), "mt_transfer").args_json(json!({"receiver_id":player.id(),"token_id":"fomc-jan-inflation:YES","amount":"1","approval":null,"memo":null})).deposit(NearToken::from_yoctonear(1)).transact().await?, "ERR_INSUFFICIENT_SHARES");
    player.call(contract.id(), "mt_transfer").args_json(json!({"receiver_id":recipient.id(),"token_id":"fomc-jan-inflation:YES","amount":"4","approval":null,"memo":null})).deposit(NearToken::from_yoctonear(1)).transact().await?.into_result()?;
    let recipient_balance: String = contract.view("mt_balance_of").args_json(json!({"account_id":recipient.id(),"token_id":"fomc-jan-inflation:YES"})).await?.json()?;
    assert_eq!(recipient_balance, "4");
    recipient.call(contract.id(), "mt_transfer_call").args_json(json!({"receiver_id":player.id(),"token_id":"fomc-jan-inflation:YES","amount":"2","approval":null,"memo":null,"msg":"no receiver contract"})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await?.into_result()?;
    let refunded_balance: String = contract.view("mt_balance_of").args_json(json!({"account_id":recipient.id(),"token_id":"fomc-jan-inflation:YES"})).await?.json()?;
    assert_eq!(refunded_balance, "4", "failed receiver call must refund shares");
    rejected(player.call(contract.id(), "buy").args_json(json!({"id":"fomc-jan-inflation","yes":true,"quantity":1})).deposit(NearToken::from_yoctonear(1)).transact().await?, "ERR_DEPOSIT");
    rejected(player.call(contract.id(), "on_result").args_json(json!({"id":"fomc-jan-inflation","challenged":false})).transact().await?, "private");
    rejected(player.call(contract.id(), "claim").args_json(json!({"id":"fomc-jan-inflation"})).transact().await?, "ERR_NOT_FINAL");
    rejected(player.call(contract.id(), "resolve").args_json(json!({"id":"fomc-jan-inflation"})).deposit(NearToken::from_near(1)).transact().await?, "ERR_RESOLUTION_TIME");
    rejected(player.call(contract.id(), "challenge").args_json(json!({"id":"fomc-jan-inflation"})).deposit(NearToken::from_near(1)).transact().await?, "ERR_STATE");
    let short_close = now_ns() + 10_000_000_000;
    creator.call(contract.id(), "create_market").args_json(json!({"id":"fomc-short-window","event":"Clock-bound rejection test","source_url":"https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf","phrase":"recession","threshold":1,"close_ns":short_close,"deadline_ns":short_close + 86_400_000_000_000u64,"b":1000})).deposit(NearToken::from_near(1)).transact().await?.into_result()?;
    worker.fast_forward(100).await?;
    rejected(player.call(contract.id(), "buy").args_json(json!({"id":"fomc-short-window","yes":true,"quantity":1})).deposit(NearToken::from_near(1)).transact().await?, "ERR_CLOSED");
    Ok(())
}
