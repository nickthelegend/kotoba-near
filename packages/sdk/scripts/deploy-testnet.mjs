import { Account, KeyPair, KeyPairSigner, JsonRpcProvider, actions } from 'near-api-js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { TESTNET_RPC } from '../src/index.mjs';

const root = resolve(import.meta.dirname, '../../..');
const credentialsFile = resolve(root, '.near-credentials/deployer.json');
let credentials;
try { credentials = JSON.parse(await readFile(credentialsFile, 'utf8')); }
catch { credentials = { account_id: process.env.NEAR_TESTNET_ACCOUNT, secret_key: process.env.NEAR_TESTNET_PRIVATE_KEY }; }
if (!credentials.account_id?.endsWith('.testnet') || !credentials.secret_key) throw new Error('Setup required: NEAR_TESTNET_ACCOUNT and NEAR_TESTNET_PRIVATE_KEY (or .near-credentials/deployer.json)');
const wasmUrl = process.env.OUTLAYER_WASM_URL;
const wasmHash = process.env.OUTLAYER_WASM_SHA256;
if (!wasmUrl?.startsWith('https://') || !/^[a-f0-9]{64}$/i.test(wasmHash || '')) throw new Error('Setup required: OUTLAYER_WASM_URL and OUTLAYER_WASM_SHA256');
const oracleBytes = await readFile(resolve(root, 'packages/oracle/target/wasm32-wasip2/release/kotoba-oracle.wasm'));
const localHash = createHash('sha256').update(oracleBytes).digest('hex');
if (localHash !== wasmHash.toLowerCase()) throw new Error('OUTLAYER_WASM_SHA256 differs from local oracle artifact');
const contractBytes = await readFile(resolve(root, 'packages/contract/target/near/kotoba_contract.wasm'));
const accountResponse = await fetch(TESTNET_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba-deploy-check', method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: credentials.account_id } }) });
if (!accountResponse.ok) throw new Error(`NEAR testnet RPC HTTP ${accountResponse.status}`);
const accountBody = await accountResponse.json();
if (accountBody.error) throw new Error(`Testnet account unavailable: ${accountBody.error.message || JSON.stringify(accountBody.error)}`);
if (accountBody.result.code_hash !== '11111111111111111111111111111111') throw new Error('Account already has a deployed contract; use a fresh testnet account');
const signer = new Account(credentials.account_id, new JsonRpcProvider({ url: TESTNET_RPC }), new KeyPairSigner(KeyPair.fromString(credentials.secret_key)));
const submit = async (receiverId, action) => {
  const result = await signer.signAndSendTransaction({ receiverId, actions: [action], waitUntil: 'FINAL', throwOnFailure: false });
  if (result.status.Failure) throw new Error(`Testnet transaction rejected: ${JSON.stringify(result.status.Failure)}`);
  return { hash: result.transaction.hash, explorer: `https://testnet.nearblocks.io/txns/${result.transaction.hash}` };
};
const deployment = await submit(credentials.account_id, actions.deployContract(contractBytes));
const initialization = await submit(credentials.account_id, actions.functionCall('new', { wasm_url: wasmUrl, wasm_hash: localHash }, 100_000_000_000_000n, 0n));
const record = { network: 'testnet', contract_id: credentials.account_id, contract_sha256: createHash('sha256').update(contractBytes).digest('hex'), oracle_sha256: localHash, oracle_url: wasmUrl, deploy: deployment, initialize: initialization };
await mkdir(resolve(root, 'deployments'), { recursive: true });
const path = resolve(root, `deployments/testnet-${new Date().toISOString().slice(0, 10)}.json`);
await writeFile(path, JSON.stringify(record, null, 2));
console.log(JSON.stringify({ record: path, contract_id: record.contract_id, deploy: deployment, initialize: initialization }, null, 2));
