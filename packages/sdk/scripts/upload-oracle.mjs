// Uploads the oracle WASM to FastFS on NEAR testnet, the storage OutLayer workers read WasmUrl sources from.
// FastFS records the bytes from the transaction arguments; the call itself is sent with 1 gas and fails by
// design (same as `outlayer upload`, github.com/out-layer/outlayer-cli src/commands/upload.rs).
import { actions } from 'near-api-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { signerFor, root, explorer } from './signer.mjs';

const CHUNK = 1 << 20;
const RECEIVER = 'outlayer.testnet';
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const str = (s) => Buffer.concat([u32(Buffer.byteLength(s)), Buffer.from(s)]);
const bytes = (b) => Buffer.concat([u32(b.length), b]);

const wasm = await readFile(resolve(root, 'packages/oracle/target/wasm32-wasip2/release/kotoba-oracle.wasm'));
const hash = createHash('sha256').update(wasm).digest('hex');
const path = `${hash}.wasm`;
const mime = 'application/wasm';
const payloads = [];
if (wasm.length <= CHUNK) {
  payloads.push(Buffer.concat([Buffer.from([0]), str(path), Buffer.from([1]), str(mime), bytes(wasm)]));
} else {
  const nonce = Math.floor(Date.now() / 1000) - 1_769_376_240;
  for (let offset = 0; offset < wasm.length; offset += CHUNK) {
    const chunk = wasm.subarray(offset, Math.min(offset + CHUNK, wasm.length));
    payloads.push(Buffer.concat([Buffer.from([1]), str(path), u32(offset), u32(wasm.length), str(mime), bytes(chunk), u32(nonce)]));
  }
}
const account = await signerFor();
const url = `https://test.fastfs.io/${account.accountId}/${RECEIVER}/${path}`;
console.log(`Uploading ${wasm.length} bytes (sha256 ${hash}) in ${payloads.length} chunk(s) from ${account.accountId}`);
const txs = [];
for (const [i, payload] of payloads.entries()) {
  const result = await account.signAndSendTransaction({ receiverId: RECEIVER, actions: [actions.functionCall('__fastdata_fastfs', new Uint8Array(payload), 1n, 0n)], waitUntil: 'FINAL', throwOnFailure: false });
  txs.push({ chunk: i + 1, hash: result.transaction.hash, explorer: explorer(result.transaction.hash) });
  console.log(`chunk ${i + 1}/${payloads.length}: ${explorer(result.transaction.hash)}`);
}
// FastFS indexes asynchronously; poll until the served bytes hash to the same value.
let served = '';
for (let attempt = 0; attempt < 40 && served !== hash; attempt++) {
  await new Promise((r) => setTimeout(r, 6000));
  const response = await fetch(url).catch(() => null);
  if (response?.ok) served = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
}
if (served !== hash) throw new Error(`FastFS did not serve matching bytes at ${url} (got ${served || 'nothing'})`);
await mkdir(resolve(root, 'deployments'), { recursive: true });
await writeFile(resolve(root, 'deployments/oracle-fastfs.json'), JSON.stringify({ url, sha256: hash, bytes: wasm.length, txs }, null, 2));
console.log(JSON.stringify({ url, sha256: hash, verified: true }, null, 2));
