// Runs the pinned oracle on OutLayer directly (no market), to check the program before a contract relies on it.
// Usage: node packages/sdk/scripts/outlayer-direct.mjs <fed-pdf-url> <phrase>
import { actions } from 'near-api-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { signerFor, root, explorer } from './signer.mjs';

const [sourceUrl, phrase] = process.argv.slice(2);
if (!sourceUrl || !phrase) throw new Error('usage: outlayer-direct.mjs <fed-pdf-url> <phrase>');
const oracle = JSON.parse(await readFile(resolve(root, 'deployments/oracle-fastfs.json'), 'utf8'));
const input = JSON.stringify({ source_url: sourceUrl, phrase, code_hash: oracle.sha256 });
const account = await signerFor();
const args = { source: { WasmUrl: { url: oracle.url, hash: oracle.sha256, build_target: 'wasm32-wasip2' } }, input_data: input, resource_limits: { max_instructions: 50_000_000_000, max_memory_mb: 256, max_execution_seconds: 90 }, response_format: 'Json' };
const result = await account.signAndSendTransaction({ receiverId: 'outlayer.testnet', actions: [actions.functionCall('request_execution', args, 300_000_000_000_000n, 30n * 10n ** 21n)], waitUntil: 'FINAL', throwOnFailure: false });
const value = result.status.SuccessValue !== undefined ? Buffer.from(result.status.SuccessValue, 'base64').toString() : null;
const record = { tx: result.transaction.hash, explorer: explorer(result.transaction.hash), input, output: value, failure: result.status.Failure ?? null, logs: result.receipts_outcome.flatMap((r) => r.outcome.logs).filter((l) => !l.startsWith('EVENT_JSON')).slice(0, 12) };
await mkdir(resolve(root, 'deployments'), { recursive: true });
await writeFile(resolve(root, `deployments/outlayer-direct-${result.transaction.hash}.json`), JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
