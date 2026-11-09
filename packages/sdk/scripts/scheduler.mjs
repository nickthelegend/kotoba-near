import { fetchFomcDates, TESTNET_RPC } from '../src/index.mjs';
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider, actions } from 'near-api-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run repeatedly from cron. It reads the official calendar each time and only creates missing markets.
// An explicit --send is required for signed testnet transactions; default prints the live plan.
const root = resolve(import.meta.dirname, '../../..');
const words = ['recession', 'inflation', 'tariffs', 'employment'];
const contractId = process.env.NEAR_TESTNET_CONTRACT;
if (!contractId && process.argv.includes('--send')) throw new Error('Setup required: NEAR_TESTNET_CONTRACT');
const dates = (await fetchFomcDates(2026)).filter(d => Date.UTC(d.year, d.month - 1, d.day) > Date.now());
const plan = dates.flatMap(d => {
  const date = `${d.year}${String(d.month).padStart(2, '0')}${String(d.day).padStart(2, '0')}`;
  // FOMC conferences start at 2:30 p.m. Eastern. The 2026 remainder is December (EST, UTC-5).
  const eventStart = Date.UTC(d.year, d.month - 1, d.day, d.month >= 11 || d.month <= 2 ? 19 : 18, 30);
  const close = eventStart - 5 * 60_000;
  return words.map(phrase => ({ id: `fomc-${d.year}-${String(d.month).padStart(2, '0')}-${phrase}`, event: `FOMC press conference · ${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`, source_url: `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${date}.pdf`, phrase, threshold: 1, close_ns: close * 1e6, deadline_ns: (eventStart + 7 * 86_400_000) * 1e6, b: 100 }));
});
if (!process.argv.includes('--send')) { console.log(JSON.stringify({ source: 'official Fed calendar', planned: plan }, null, 2)); process.exit(0); }
const file = resolve(root, '.near-credentials/deployer.json');
let credentials;
if (process.env.NEAR_TESTNET_ACCOUNT || process.env.NEAR_TESTNET_PRIVATE_KEY) {
  credentials = { account_id: process.env.NEAR_TESTNET_ACCOUNT, secret_key: process.env.NEAR_TESTNET_PRIVATE_KEY };
} else {
  try { credentials = JSON.parse(await readFile(file, 'utf8')); } catch { credentials = {}; }
}
if (!credentials.account_id || !credentials.secret_key) throw new Error('Setup required: NEAR_TESTNET_ACCOUNT and NEAR_TESTNET_PRIVATE_KEY (or .near-credentials/deployer.json)');
if (!credentials.account_id.endsWith('.testnet')) throw new Error('Testnet account required');
const signer = new Account(credentials.account_id, new JsonRpcProvider({ url: TESTNET_RPC }), new KeyPairSigner(KeyPair.fromString(credentials.secret_key)));
const results = [];
for (const market of plan) {
  const args_base64 = Buffer.from(JSON.stringify({ id: market.id })).toString('base64');
  const response = await fetch(TESTNET_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contractId, method_name: 'get_market', args_base64 } }) });
  const body = await response.json();
  if (body.error) throw new Error(`NEAR RPC: ${body.error.message}`);
  if (JSON.parse(Buffer.from(body.result.result).toString('utf8'))) continue;
  const tx = await signer.signAndSendTransaction({ receiverId: contractId, actions: [actions.functionCall('create_market', market, 50_000_000_000_000n, 100_000_000_000_000_000_000_000n)], waitUntil: 'FINAL', throwOnFailure: false });
  if (tx.status.Failure) throw new Error(`Market creation rejected: ${JSON.stringify(tx.status.Failure)}`);
  results.push({ id: market.id, tx_hash: tx.transaction.hash, explorer: `https://testnet.nearblocks.io/txns/${tx.transaction.hash}` });
}
await mkdir(resolve(root, 'deployments'), { recursive: true });
await writeFile(resolve(root, `deployments/scheduler-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ source: 'official Fed calendar', results }, null, 2));
console.log(JSON.stringify({ created: results }, null, 2));
