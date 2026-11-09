// Usage: node packages/sdk/scripts/verify-attestation.mjs <deployments/outlayer-*.json>
import { readFile } from 'node:fs/promises';
import { verifyExecution } from '../src/attestation.mjs';
const record = JSON.parse(await readFile(process.argv[2], 'utf8'));
const wasmHash = JSON.parse(record.input).code_hash;
const result = await verifyExecution({ txHash: record.tx, input: record.input, output: record.output, wasmHash });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
