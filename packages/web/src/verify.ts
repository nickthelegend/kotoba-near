// In-browser re-check of an OutLayer execution attestation, using only public data:
// the attestation record from OutLayer's API, the exact input/output from the transaction, and a NEAR view call.
// The Intel signature chain check needs Intel collateral and runs in the CLI (packages/sdk/scripts/verify-attestation.mjs).
import { OUTLAYER_API, measurementsApproved, sha256Hex } from './lib';

type Raw = {
  task_type: string; task_id: number; repo_url?: string | null; commit_hash?: string | null; build_target?: string | null; wasm_hash?: string | null;
  executed_wasm_sha256?: string; input_hash?: string | null; output_hash: string; block_height?: number | null; caller_account_id?: string | null;
  project_id?: string | null; secrets_ref?: string | null; timestamp: number; attached_usd?: string | null; tdx_quote: string; request_id: number;
};
export type Check = { key: string; label: string; detail: string; ok: boolean };
export type LiveVerification = { requestId: number; quoteBytes: number; mrtd: string; rtmr3: string; reportData: string; checks: Check[] };

const enc = new TextEncoder();
function le64(n: number | bigint, signed: boolean) { const b = new Uint8Array(8); const v = new DataView(b.buffer); if (signed) v.setBigInt64(0, BigInt(n), true); else v.setBigUint64(0, BigInt(n), true); return b; }
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function taskHash(a: Raw) {
  const parts: Uint8Array[] = [enc.encode(a.task_type), le64(a.task_id, true)];
  for (const k of ['repo_url', 'commit_hash', 'build_target', 'wasm_hash', 'input_hash'] as const) if (a[k] != null) parts.push(enc.encode(a[k] as string));
  parts.push(enc.encode(a.output_hash));
  if (a.block_height != null) parts.push(le64(a.block_height, false));
  for (const k of ['caller_account_id', 'project_id', 'secrets_ref'] as const) if (a[k] != null) parts.push(enc.encode(a[k] as string));
  parts.push(le64(a.timestamp, true));
  if (a.attached_usd != null) parts.push(enc.encode(a.attached_usd));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  return sha256Hex(all);
}

export async function verifyLive(tx: string, input: string, output: string, wasmHash: string): Promise<LiveVerification> {
  const response = await fetch(`${OUTLAYER_API}/attestations/by-tx/${tx}`);
  if (!response.ok) throw new Error(`OutLayer attestation API HTTP ${response.status}`);
  const a = (await response.json()) as Raw;
  const quote = Uint8Array.from(atob(a.tdx_quote), (c) => c.charCodeAt(0));
  const at = (o: number, n = 48) => hex(quote.subarray(o, o + n));
  const m = { mrtd: at(48 + 136), rtmr0: at(48 + 328), rtmr1: at(48 + 376), rtmr2: at(48 + 424), rtmr3: at(48 + 472) };
  const reportData = at(48 + 520, 64);
  const [inputHash, outputHash, task, approved] = await Promise.all([sha256Hex(input), sha256Hex(output), taskHash(a), measurementsApproved(m).catch(() => false)]);
  return {
    requestId: a.request_id, quoteBytes: quote.length, mrtd: m.mrtd, rtmr3: m.rtmr3, reportData,
    checks: [
      { key: 'code', label: 'Pinned program ran', detail: `executed WASM sha256 ${String(a.executed_wasm_sha256 ?? a.wasm_hash).slice(0, 12)}… = contract pin`, ok: a.wasm_hash === wasmHash && (a.executed_wasm_sha256 ?? wasmHash) === wasmHash },
      { key: 'input', label: 'Same question', detail: `sha256(input sent on-chain) = attested input_hash`, ok: inputHash === a.input_hash },
      { key: 'output', label: 'Same answer', detail: `sha256(output the contract received) = attested output_hash`, ok: outputHash === a.output_hash },
      { key: 'bind', label: 'Sealed by the TEE', detail: `TDX quote report_data = sha256(task fields)`, ok: reportData === task + '0'.repeat(64) },
      { key: 'measure', label: 'Approved enclave build', detail: `worker.outlayer.testnet · is_measurements_approved`, ok: approved },
    ],
  };
}
