// Usage: node packages/sdk/scripts/verify-attestation.mjs <deployments/outlayer-*.json>
import { readFile } from 'node:fs/promises';
import { verifyExecution, verifyResolutionTx } from '../src/attestation.mjs';
import { resolve } from 'node:path';
let result;
if (process.argv[2] === '--tx') {
  const tx = process.argv[3], sender = process.argv[5];
  if (process.argv[4] !== '--sender' || !/^(?:[a-z0-9._-]+\.testnet|[a-f0-9]{64})$/.test(sender ?? '') || !/^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(tx ?? '')) throw Error('Usage: verify-attestation.mjs --tx <hash> --sender <testnet-account>');
  const pin = JSON.parse(await readFile(resolve(import.meta.dirname, '../../../deployments/testnet-2026-11-09.json'), 'utf8')).oracle_sha256;
  result = (await verifyResolutionTx(tx, sender, pin, 'https://near-testnet.drpc.org')).verification;
} else {
  const record = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const wasmHash = JSON.parse(record.input).code_hash;
  result = await verifyExecution({ txHash: record.tx, input: record.input, output: record.output, wasmHash });
}
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
