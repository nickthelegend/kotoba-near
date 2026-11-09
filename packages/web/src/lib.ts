import deployment from '../../../deployments/testnet-2026-11-09.json';
import run from '../../../deployments/real-run.json';
import oracle from '../../../deployments/oracle-fastfs.json';

export type OracleOutput = { count: number; transcript_sha256: string; source_url: string; code_hash: string; attestation: string };
export type Status = 'Open' | 'Provisional' | 'Final';
export type Market = {
  id: string; event: string; source_url: string; phrase: string; threshold: number; close_ns: number; deadline_ns: number; b: number;
  yes: number; no: number; burned_yes: number; burned_no: number; creator: string; status: Status; result: OracleOutput | null;
  challenge_until_ns: number | null; pending: boolean; resolver: string | null; challenger: string | null;
};
export type Attestation = {
  request_id: number; attestation_id: number; tx: string; caller: string; block_height: number; timestamp: number; wasm_hash: string;
  input_hash: string; output_hash: string; measurements: { mrtd: string; rtmr3: string }; report_data: string;
  tcb: { status?: string; advisory_ids?: string[]; error?: string }; checks: Record<string, boolean>; ok: boolean; source: string;
};
export type Step = {
  step: string; signer: string; method?: string; args?: Record<string, unknown>; tx: string; explorer: string; at: string; ok: boolean;
  return?: string | null; failure?: string | null; logs?: string[]; account?: string;
  outlayer?: { input: string; output: string; log: string | null; attestation: Attestation };
};

export const CONTRACT: string = (import.meta.env.VITE_NEAR_TESTNET_CONTRACT as string | undefined) || deployment.contract_id;
export const RPC: string = (import.meta.env.VITE_NEAR_TESTNET_RPC as string | undefined) || 'https://test.rpc.fastnear.com';
// FastNEAR answers 429 without CORS headers when busy, so reads fall back to the official endpoint.
const RPCS = [...new Set([RPC, 'https://rpc.testnet.near.org'])];
let preferred = 0;
async function rpcPost(body: unknown): Promise<any> {
  let last: unknown;
  for (let i = 0; i < RPCS.length; i++) {
    const k = (preferred + i) % RPCS.length;
    try {
      const response = await fetch(RPCS[k], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
      preferred = k;
      return await response.json();
    } catch (e) { last = e; }
  }
  throw new Error(`NEAR testnet RPC unreachable (${RPCS.map((u) => new URL(u).host).join(', ')}): ${(last as Error)?.message ?? last}`);
}
export const OUTLAYER_API = 'https://testnet-api.outlayer.ai';
export const ORACLE = oracle as { url: string; sha256: string; bytes: number; txs: { chunk: number; hash: string; explorer: string }[] };
export const DEPLOYMENT = deployment as { contract_id: string; contract_sha256: string; oracle_sha256: string; oracle_url: string; deploy: { hash: string; explorer: string }; initialize: { hash: string; explorer: string } };
export const RUN = run as { network: string; contract: string; steps: Step[] };
export const UNIT_NEAR = 0.001; // one winning share pays 0.001 NEAR
export const PINNED_TEXT_SHA = 'b3a6ffd6c6912f1ff63c04bbb544913eff55917cbbb57fab17d317d28ff706f1';
export const PINNED_PDF_SHA = '2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3';

export const txUrl = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const accountUrl = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
export const short = (s: string, a = 6, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

async function call<T>(method_name: string, args: unknown, account_id = CONTRACT): Promise<T> {
  const args_base64 = btoa(JSON.stringify(args));
  const body = await rpcPost({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id, method_name, args_base64 } });
  if (body.error) throw new Error(body.error.data || body.error.message || 'NEAR RPC rejected the request');
  if (body.result?.error) throw new Error(body.result.error);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result)));
}
export const listMarkets = () => call<Market[]>('list_markets', {});
export const getMarket = (id: string) => call<Market | null>('get_market', { id });
export const quote = (id: string, yes: boolean, quantity: number) => call<string>('quote', { id, yes, quantity });
export const balanceOf = (id: string, account: string, yes: boolean) => call<number>('balance_of', { id, account, yes });
export const measurementsApproved = (m: Record<string, string>) => call<boolean>('is_measurements_approved', { measurements: m }, 'worker.outlayer.testnet');

export async function viewAccount(account_id: string): Promise<{ amount: string; storage_usage: number }> {
  const body = await rpcPost({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'view_account', finality: 'final', account_id } });
  if (body.error) throw new Error(body.error.data || body.error.message);
  return body.result;
}

export function yesPrice(m: Pick<Market, 'yes' | 'no' | 'b'>) { const d = (m.yes - m.no) / m.b; return d >= 0 ? 1 / (1 + Math.exp(-d)) : Math.exp(d) / (1 + Math.exp(d)); }
export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const yoctoToNear = (y: string | bigint) => Number(BigInt(y) / 10n ** 18n) / 1e6;
export const fmtNear = (n: number, digits = 3) => `${n.toFixed(digits)} NEAR`;
export const outcome = (m: Market) => (m.result ? (m.result.count >= m.threshold ? 'YES' : 'NO') : null);
export const subsidy = (b: number) => Math.ceil(b * Math.LN2) * UNIT_NEAR;
export const eventDate = (m: Market) => { const d = m.source_url.match(/FOMCpresconf(\d{4})(\d{2})(\d{2})\.pdf$/); return d ? new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])) : null; };
export const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function countdown(targetMs: number, now: number) {
  const s = Math.max(0, Math.floor((targetMs - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: s === 0 };
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** OutLayer runs recorded for a market (resolve and challenge), newest last. */
export const runsFor = (id: string) => RUN.steps.filter((s) => s.outlayer && (s.args as { id?: string } | undefined)?.id === id);

/** Whole-word, case-insensitive match over whitespace-collapsed text: the oracle's counting rule. */
export function splitHits(text: string, phrase: string) {
  const words = phrase.trim().split(/\s+/).map((w) => w.replace(/[^a-z]/gi, ''));
  const re = new RegExp(`(?<![A-Za-z0-9])(${words.join('\\s+')})(?![A-Za-z0-9])`, 'gi');
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push({ text: text.slice(last, m.index), hit: false }, { text: m[0], hit: true });
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push({ text: text.slice(last), hit: false });
  return parts;
}
