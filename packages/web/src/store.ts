// Shared live state: markets (polled), account balances, optimistic bets and toasts.
// One poller serves every screen, so odds move together everywhere and one refresh updates all of them.
import { useEffect, useSyncExternalStore } from 'react';
import { listMarkets, viewAccount, type Market } from './lib';
import { explain, spendableYocto, type Explained } from './errors';

function createStore<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => T)) { state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }; subs.forEach((f) => f()); },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}

/* ---------- markets: one poller, every 10 s while the tab is visible ---------- */

export const POLL_MS = 10_000;
type MarketsState = { markets: Market[] | null; problem: Explained | null; loading: boolean; at: number };
const marketsStore = createStore<MarketsState>({ markets: null, problem: null, loading: false, at: 0 });
let inflight: Promise<void> | null = null;
export function refreshMarkets(): Promise<void> {
  if (inflight) return inflight;
  marketsStore.set({ loading: true });
  inflight = listMarkets()
    .then((markets) => marketsStore.set({ markets, problem: null, at: Date.now() }))
    .catch((e) => marketsStore.set({ problem: explain(e) }))
    .finally(() => { marketsStore.set({ loading: false }); inflight = null; });
  return inflight;
}
let users = 0;
let timer: number | undefined;
const onVisible = () => { if (!document.hidden && Date.now() - marketsStore.get().at > POLL_MS) refreshMarkets(); };

/** Live markets with pending bets applied on top (optimistic), so the price moves the moment you click. */
export function useMarkets() {
  const s = useSyncExternalStore(marketsStore.subscribe, marketsStore.get);
  const pending = usePending();
  useEffect(() => {
    if (++users === 1) {
      timer = window.setInterval(() => { if (!document.hidden) refreshMarkets(); }, POLL_MS);
      document.addEventListener('visibilitychange', onVisible);
    }
    if (!marketsStore.get().at || Date.now() - marketsStore.get().at > POLL_MS) refreshMarkets();
    return () => { if (--users === 0) { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); } };
  }, []);
  const markets = s.markets && pending.length ? s.markets.map((m) => applyPending(m, pending)) : s.markets;
  return { markets, problem: s.problem, error: s.problem ? `${s.problem.title}. ${s.problem.detail}` : '', loading: s.loading, at: s.at, reload: refreshMarkets };
}

/* ---------- optimistic bets ---------- */

export type PendingBet = { key: string; id: string; yes: boolean; qty: number; account: string; stage: 'signing' | 'pending'; tx?: string };
const pendingStore = createStore<{ list: PendingBet[] }>({ list: [] });
export const usePending = () => useSyncExternalStore(pendingStore.subscribe, () => pendingStore.get().list);
export const pending = {
  add(p: PendingBet) { pendingStore.set((s) => ({ list: [...s.list, p] })); },
  update(key: string, patch: Partial<PendingBet>) { pendingStore.set((s) => ({ list: s.list.map((p) => (p.key === key ? { ...p, ...patch } : p)) })); },
  remove(key: string) { pendingStore.set((s) => ({ list: s.list.filter((p) => p.key !== key) })); },
};
export type LiveMarket = Market & { pendingQty?: number };
function applyPending(m: Market, list: PendingBet[]): LiveMarket {
  const mine = list.filter((p) => p.id === m.id);
  if (!mine.length) return m;
  const yes = mine.filter((p) => p.yes).reduce((n, p) => n + p.qty, 0);
  const no = mine.filter((p) => !p.yes).reduce((n, p) => n + p.qty, 0);
  return { ...m, yes: m.yes + yes, no: m.no + no, pendingQty: yes + no };
}

/* ---------- balances ---------- */

type Bal = { yocto: bigint | null; near: number | null; problem: Explained | null; at: number };
const balStore = createStore<Record<string, Bal>>({});
export async function refreshBalance(account: string) {
  if (!account) return;
  try {
    const a = await viewAccount(account);
    const yocto = spendableYocto(a.amount, a.storage_usage);
    balStore.set((s) => ({ ...s, [account]: { yocto, near: Number(yocto / 10n ** 18n) / 1e6, problem: null, at: Date.now() } }));
  } catch (e) {
    balStore.set((s) => ({ ...s, [account]: { ...(s[account] ?? { yocto: null, near: null }), problem: explain(e), at: Date.now() } }));
  }
}
/** Spendable NEAR testnet balance (total minus the storage lock), refreshed every 20 s and after each transaction. */
export function useBalance(account: string) {
  const all = useSyncExternalStore(balStore.subscribe, balStore.get);
  useEffect(() => {
    if (!account) return;
    refreshBalance(account);
    const t = setInterval(() => { if (!document.hidden) refreshBalance(account); }, 20_000);
    return () => clearInterval(t);
  }, [account]);
  const b = account ? all[account] : undefined;
  return { balance: b?.near ?? null, yocto: b?.yocto ?? null, problem: b?.problem ?? null, error: b?.problem?.title ?? '' };
}

/* ---------- toasts ---------- */

export type Toast = { id: number; tone: 'pending' | 'success' | 'error' | 'info'; title: string; body?: string; tx?: string };
const toastStore = createStore<{ list: Toast[] }>({ list: [] });
let nextToast = 1;
const timers = new Map<number, number>();
function autoDismiss(t: Toast) {
  clearTimeout(timers.get(t.id));
  if (t.tone === 'success' || t.tone === 'info') timers.set(t.id, window.setTimeout(() => toast.dismiss(t.id), 7000));
}
export const toast = {
  push(t: Omit<Toast, 'id'>) { const full = { ...t, id: nextToast++ }; toastStore.set((s) => ({ list: [...s.list.slice(-3), full] })); autoDismiss(full); return full.id; },
  update(id: number, patch: Partial<Omit<Toast, 'id'>>) {
    toastStore.set((s) => ({ list: s.list.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const t = toastStore.get().list.find((x) => x.id === id); if (t) autoDismiss(t);
  },
  dismiss(id: number) { clearTimeout(timers.get(id)); toastStore.set((s) => ({ list: s.list.filter((t) => t.id !== id) })); },
};
export const useToasts = () => useSyncExternalStore(toastStore.subscribe, () => toastStore.get().list);

/** Fired after any confirmed transaction so position lists re-read their balances. */
export const CHAIN_CHANGED = 'kotoba:chain-changed';
