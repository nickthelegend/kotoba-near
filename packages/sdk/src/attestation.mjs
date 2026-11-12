// Independent check of an OutLayer per-execution TDX attestation.
// Method from github.com/out-layer/outlayer WORKER_ATTESTATION.md and worker/src/tdx_attestation.rs:
//   report_data[0..32] = SHA-256(task_type ‖ task_id(i64 LE) ‖ build_target ‖ wasm_hash ‖ input_hash ‖ output_hash ‖
//                                block_height(u64 LE) ‖ caller ‖ timestamp(i64 LE) ‖ attached_usd)
// The quote signature chain is verified with Phala's dcap-qvl against Intel collateral from the Phala PCCS.
import { createHash } from 'node:crypto';
import { getCollateralAndVerify } from '@phala/dcap-qvl';
import { TESTNET_RPC, testnetFetch } from './index.mjs';
import { readResolutionReceipts } from './resolution-receipts.mjs';

export const OUTLAYER_TESTNET_API = 'https://testnet-api.outlayer.ai';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const le64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const leU64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

// TDX quote v4: 48-byte header, then the TD report body. Offsets are into the whole quote.
const MRTD = 48 + 136, RTMR0 = 48 + 328, REPORT_DATA = 48 + 520, M = 48;

export async function fetchAttestationByTx(txHash, api = OUTLAYER_TESTNET_API) {
  const response = await fetch(`${api}/attestations/by-tx/${txHash}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`OutLayer attestation HTTP ${response.status} for ${txHash}`);
  return response.json();
}

export function taskHash(a) {
  const parts = [Buffer.from(a.task_type), le64(a.task_id)];
  for (const k of ['repo_url', 'commit_hash', 'build_target', 'wasm_hash', 'input_hash']) if (a[k] != null) parts.push(Buffer.from(a[k]));
  parts.push(Buffer.from(a.output_hash));
  if (a.block_height != null) parts.push(leU64(a.block_height));
  for (const k of ['caller_account_id', 'project_id', 'secrets_ref']) if (a[k] != null) parts.push(Buffer.from(a[k]));
  parts.push(le64(a.timestamp));
  if (a.attached_usd != null) parts.push(Buffer.from(a.attached_usd));
  return sha(Buffer.concat(parts));
}

export function quoteFields(quote) {
  const hex = (o) => quote.subarray(o, o + M).toString('hex');
  return { mrtd: hex(MRTD), rtmr0: hex(RTMR0), rtmr1: hex(RTMR0 + M), rtmr2: hex(RTMR0 + 2 * M), rtmr3: hex(RTMR0 + 3 * M), report_data: quote.subarray(REPORT_DATA, REPORT_DATA + 64).toString('hex') };
}

async function measurementsApproved(m, registry = 'worker.outlayer.testnet', rpc = TESTNET_RPC) {
  const args_base64 = Buffer.from(JSON.stringify({ measurements: { mrtd: m.mrtd, rtmr0: m.rtmr0, rtmr1: m.rtmr1, rtmr2: m.rtmr2, rtmr3: m.rtmr3 } })).toString('base64');
  const response = await testnetFetch({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: registry, method_name: 'is_measurements_approved', args_base64 } }) }, rpc);
  const body = await response.json();
  if (body.error || body.result?.error) throw new Error(`is_measurements_approved failed: ${JSON.stringify(body.error || body.result.error).slice(0, 200)}`);
  return JSON.parse(Buffer.from(body.result.result).toString()) === true;
}

/** Verifies one execution end to end. `input` and `output` are the exact strings sent and returned on chain. */
export async function verifyExecution({ txHash, input, output, wasmHash }) {
  const a = await fetchAttestationByTx(txHash);
  const quote = Buffer.from(a.tdx_quote, 'base64');
  const fields = quoteFields(quote);
  const checks = {
    wasm_hash_pinned: a.wasm_hash === wasmHash && a.executed_wasm_sha256 === wasmHash,
    input_hash: a.input_hash === sha(input),
    output_hash: a.output_hash === sha(output),
    report_data_binds_task: fields.report_data === taskHash(a) + '0'.repeat(64),
    measurements_approved_on_chain: await measurementsApproved(fields),
  };
  let tcb = null;
  try {
    const verified = await getCollateralAndVerify(quote);
    tcb = { status: verified.status, advisory_ids: verified.advisory_ids ?? [] };
    checks.intel_signature_chain = true;
  } catch (error) {
    tcb = { error: String(error.message || error).slice(0, 200) };
    checks.intel_signature_chain = false;
  }
  return { request_id: a.request_id, attestation_id: a.id, tx: a.transaction_hash, caller: a.caller_account_id, block_height: a.block_height, timestamp: a.timestamp, wasm_hash: a.wasm_hash, input_hash: a.input_hash, output_hash: a.output_hash, measurements: { mrtd: fields.mrtd, rtmr3: fields.rtmr3 }, report_data: fields.report_data.slice(0, 64), tcb, checks, ok: Object.values(checks).every(Boolean), source: `${OUTLAYER_TESTNET_API}/attestations/by-tx/${txHash}` };
}

/** Reads the exact OutLayer input and output from a resolve/challenge transaction, then verifies the attestation. */
export async function verifyResolutionTx(txHash, senderId, wasmHash, rpc = TESTNET_RPC) {
  const result = await readResolutionReceipts({ hash: txHash, sender: senderId, rpc });
  if (result.status?.SuccessValue !== Buffer.from('true').toString('base64')) throw new Error('Factory callback did not accept this resolution');
  const request = result.receipts.flatMap((r) => r.receipt?.Action?.actions ?? []).map((a) => a.FunctionCall).find((f) => f?.method_name === 'request_execution');
  if (!request) throw new Error('This transaction made no OutLayer request_execution call');
  const args = JSON.parse(Buffer.from(request.args, 'base64').toString());
  const outcome = result.receipts_outcome.find((r) => r.outcome.executor_id.startsWith('outlayer.') && r.outcome.status.SuccessValue && Buffer.from(r.outcome.status.SuccessValue, 'base64').toString().includes('transcript_sha256'));
  if (!outcome) throw new Error('OutLayer returned no oracle output in this transaction');
  const output = Buffer.from(outcome.outcome.status.SuccessValue, 'base64').toString();
  return { output: JSON.parse(output), verification: await verifyExecution({ txHash, input: args.input_data, output, wasmHash: wasmHash ?? args.source?.WasmUrl?.hash }) };
}
