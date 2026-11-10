import deployment from '../../../deployments/testnet-2026-11-09.json';
import run from '../../../deployments/real-run.json';
import oracle from '../../../deployments/oracle-fastfs.json';
import { RpcError, rpcErrorFrom, txFailure } from './errors';

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
// FastNEAR answers 429 when busy (sometimes without CORS headers), so reads fail over to dRPC's public testnet endpoint.
// rpc.testnet.near.org is deprecated and answers every call with a -429 body, so it is not in the list.
const RPCS = [...new Set([RPC, 'https://near-testnet.drpc.org'])];
let preferred = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** POST to the first RPC that answers. A 429 (HTTP or JSON -429) or a network failure fails over to the next endpoint;
 * when every endpoint is rate-limited it backs off once (1.5 s) and tries again before giving up with the real error. */
async function rpcPost(body: unknown): Promise<any> {
  let last: unknown;
  for (let round = 0; round < 2; round++) {
    let limited = 0;
    for (let i = 0; i < RPCS.length; i++) {
      const k = (preferred + i) % RPCS.length;
      try {
        const response = await fetch(RPCS[k], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const json = response.status === 429 ? null : await response.json().catch(() => null);
        const limit = rpcErrorFrom(json, response.status);
        if (limit && limit.status === 429) { limited++; throw limit; }
        // dRPC's free tier answers {"error":{"code":30,"message":"Request timeout on the free plan…"}}: try the next node.
        if (json?.error?.code === 30) throw new RpcError(`${json.error.message} (${new URL(RPCS[k]).host})`, { status: response.status });
        if (!response.ok) throw new RpcError(`NEAR RPC HTTP ${response.status} from ${new URL(RPCS[k]).host}`, { status: response.status });
        preferred = k;
        return json;
      } catch (e) { last = e; }
    }
    if (limited === 0 || round === 1) break;
    await sleep(1500);
  }
  const reason = (last as Error)?.message ?? String(last);
  if ((last as RpcError)?.status === 429) throw last;
  throw new RpcError(`NEAR testnet RPC unreachable (${RPCS.map((u) => new URL(u).host).join(', ')}): ${reason}`, { status: (last as RpcError)?.status });
}
/** Like rpcPost, but a JSON-RPC error or a view-call panic is thrown as an RpcError the mapper understands. */
async function rpc<T>(method: string, params: unknown): Promise<T> {
  const body = await rpcPost({ jsonrpc: '2.0', id: 'kotoba', method, params });
  const e = rpcErrorFrom(body);
  if (e) throw e;
  return body.result as T;
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
  const result = await rpc<{ result: number[] }>('query', { request_type: 'call_function', finality: 'final', account_id, method_name, args_base64 });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result)));
}
export const listMarkets = () => call<Market[]>('list_markets', {});
export const getMarket = (id: string) => call<Market | null>('get_market', { id });
export const quote = (id: string, yes: boolean, quantity: number) => call<string>('quote', { id, yes, quantity });
export const balanceOf = (id: string, account: string, yes: boolean) => call<number>('balance_of', { id, account, yes });
export const batchBalance = (account_id: string, token_ids: string[]) => call<string[]>('mt_batch_balance_of', { account_id, token_ids });
export const measurementsApproved = (m: Record<string, string>) => call<boolean>('is_measurements_approved', { measurements: m }, 'worker.outlayer.testnet');

export const viewAccount = (account_id: string) => rpc<{ amount: string; storage_usage: number }>('query', { request_type: 'view_account', finality: 'optimistic', account_id });

/** Final outcome of a transaction: polls the RPC `tx` method until it has executed (or `timeoutMs` passes).
 * Returns null on success and the failure string (the contract's panic, when there is one) if it failed. */
export async function waitForTx(hash: string, sender: string, timeoutMs = 90_000): Promise<string | null> {
  const until = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < until) {
    try {
      const r = await rpc<{ final_execution_status?: string; status?: unknown }>('tx', { tx_hash: hash, sender_account_id: sender, wait_until: 'EXECUTED_OPTIMISTIC' });
      if (r.status) return txFailure(r);
    } catch (e) {
      last = e;
      // Not indexed yet, or the node timed out waiting: poll again. Anything else is a real error.
      const name = (e as RpcError).causeName ?? '';
      if (!/UNKNOWN_TRANSACTION|TIMEOUT_ERROR/.test(name) && (e as RpcError).status !== 429 && !/unreachable/.test((e as Error).message)) throw e;
    }
    await sleep(2000);
  }
  throw new Error(`TX_TIMEOUT: no result for ${hash} after ${Math.round(timeoutMs / 1000)} s${last ? ` (last: ${(last as Error).message})` : ''}`);
}

export function yesPrice(m: Pick<Market, 'yes' | 'no' | 'b'>) { const d = (m.yes - m.no) / m.b; return d >= 0 ? 1 / (1 + Math.exp(-d)) : Math.exp(d) / (1 + Math.exp(d)); }
export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const yoctoToNear = (y: string | bigint) => Number(BigInt(y) / 10n ** 18n) / 1e6;
export const fmtNear = (n: number, digits = 3) => `${n.toFixed(digits)} NEAR`;
/** Fintech-style NEAR amount: 1,234 · 12.5 · 0.121 · 0.0061 (never more than 4 decimals, trailing zeros dropped). */
export function near(v: bigint | string | number) {
  const n = typeof v === 'number' ? v : yoctoToNear(v);
  const max = n >= 100 ? 0 : n >= 1 ? 2 : n >= 0.01 ? 3 : 4;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: 0 })} NEAR`;
}
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

/** One scheduled event (a press conference) and the word markets opened on it. */
export type KEvent = { key: string; title: string; source: string; date: Date | null; closeMs: number; markets: Market[]; open: boolean };
export function groupEvents(markets: Market[], now: number): KEvent[] {
  const map = new Map<string, Market[]>();
  for (const m of markets) map.set(m.source_url, [...(map.get(m.source_url) ?? []), m]);
  return [...map.entries()].map(([source, list]) => {
    const date = eventDate(list[0]);
    const closeMs = Math.min(...list.map((m) => m.close_ns / 1e6));
    const open = list.some((m) => m.status === 'Open' && m.close_ns / 1e6 > now);
    return { key: source, title: 'Fed press conference', source, date, closeMs, markets: list, open };
  }).sort((a, b) => Number(b.open) - Number(a.open) || (a.open ? a.closeMs - b.closeMs : b.closeMs - a.closeMs));
}
export const isOpen = (m: Market, now: number) => m.status === 'Open' && m.close_ns / 1e6 > now;
export const shares = (m: Market) => m.yes + m.no;
export const fmtTimeUTC = (ms: number) => new Date(ms).toISOString().slice(11, 16);
