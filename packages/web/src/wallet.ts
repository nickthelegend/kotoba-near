import { useEffect, useState } from 'react';
import type { WalletSelector } from '@near-wallet-selector/core';
import { CONTRACT, viewAccount } from './lib';
import { explain, type Explained } from './errors';

const MNW_ORIGIN = 'https://testnet.mynearwallet.com';
let selectorPromise: Promise<WalletSelector> | null = null;
// Loaded on demand so the landing page does not pay for the wallet bundle.
const getSelector = () => (selectorPromise ??= Promise.all([import('@near-wallet-selector/core'), import('@near-wallet-selector/my-near-wallet')])
  .then(([core, mnw]) => core.setupWalletSelector({ network: 'testnet', modules: [mnw.setupMyNearWallet()] })));

/** The result of a signed call: the transaction hash, and the outcome when the wallet already waited for it. */
export type Sent = { hash: string | null; outcome: unknown };

export function useWallet() {
  const [account, setAccount] = useState('');
  const [problem, setProblem] = useState<Explained | null>(null);
  /** Set when the signed-in account cannot be used on testnet (a mainnet name, or an account testnet has never seen). */
  const [network, setNetwork] = useState<Explained | null>(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    getSelector().then((s) => {
      setReady(true);
      const sync = () => setAccount(s.store.getState().accounts.find((a) => a.active)?.accountId ?? '');
      sync();
      const sub = s.store.observable.subscribe(sync);
      unsub = () => sub.unsubscribe();
    }).catch((e) => setProblem({ ...explain(e), title: 'The wallet could not load', next: 'Reload the page. If it persists, MyNearWallet may be down.' }));
    return () => unsub?.();
  }, []);
  // Network check: a .near name is mainnet; anything else must exist on testnet.
  useEffect(() => {
    setNetwork(null);
    if (!account) return;
    if (account.endsWith('.near')) { setNetwork(explain(new Error(`account ${account} does not exist while viewing`))); return; }
    let live = true;
    viewAccount(account).catch((e) => { const x = explain(e); if (live && (x.kind === 'network_mismatch' || x.kind === 'unknown_account')) setNetwork(x); });
    return () => { live = false; };
  }, [account]);
  async function connect() {
    setProblem(null); setConnecting(true);
    try { const w = await (await getSelector()).wallet('my-near-wallet'); await (w as unknown as { signIn: (p: { contractId: string; methodNames: string[] }) => Promise<unknown> }).signIn({ contractId: CONTRACT, methodNames: [] }); }
    catch (e) { setProblem(explain(e)); }
    finally { setConnecting(false); }
  }
  async function disconnect() {
    try { const w = await (await getSelector()).wallet(); await w.signOut(); } catch (e) { setProblem(explain(e)); }
    setAccount('');
  }
  /** Signs one function call. Calls without a deposit are signed by the function-call key MyNearWallet issued at sign-in
   * (no popup); calls with a deposit open the MyNearWallet popup. The popup's success message carries the hash, which we
   * keep so the caller can follow the transaction even when the wallet's own status lookup fails. */
  async function callContract(methodName: string, args: object, depositYocto: string, tgas = 30): Promise<Sent> {
    const w = await (await getSelector()).wallet();
    let hash: string | null = null;
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin === MNW_ORIGIN && ev.data?.status === 'success' && typeof ev.data.transactionHashes === 'string') hash = ev.data.transactionHashes.split(',')[0];
    };
    addEventListener('message', onMessage);
    try {
      const outcome = await w.signAndSendTransaction({ receiverId: CONTRACT, actions: [{ type: 'FunctionCall', params: { methodName, args, gas: String(BigInt(tgas) * 10n ** 12n), deposit: depositYocto } }] });
      const o = outcome as { transaction?: { hash?: string }; transaction_outcome?: { id?: string } } | undefined;
      return { hash: o?.transaction?.hash ?? o?.transaction_outcome?.id ?? hash, outcome };
    } catch (e) {
      // The wallet sent it but its status lookup failed ("Transaction … doesn't exist"): keep following the hash.
      const fromMsg = String((e as Error)?.message ?? '').match(/Transaction (\w{43,44}) doesn't exist/)?.[1];
      if (hash || fromMsg) return { hash: hash ?? fromMsg!, outcome: null };
      throw e;
    } finally { removeEventListener('message', onMessage); }
  }
  return { account, problem, network, ready, connecting, connect, disconnect, callContract, setProblem };
}
export type Wallet = ReturnType<typeof useWallet>;
