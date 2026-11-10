import { useEffect, useState } from 'react';
import type { InjectedWallet, WalletSelector } from '@near-wallet-selector/core';
import { CONTRACT, viewAccount } from './lib';
import { explain, type Explained } from './errors';

/** Meteor Wallet (testnet) is the wallet: it opens in a pop-up (or its browser extension) and posts the result back to this
 * page, so there is no redirect route. MyNearWallet was dropped on 2026-11-10: its testnet pop-up now answers
 * "MyNearWallet can't connect to apps anymore" and sends people to Meteor. */
export const WALLET = { id: 'meteor-wallet', name: 'Meteor Wallet', url: 'https://wallet.meteorwallet.app' } as const;
let selectorPromise: Promise<WalletSelector> | null = null;
// Loaded on demand so the landing page does not pay for the wallet bundle.
const getSelector = () => (selectorPromise ??= Promise.all([import('@near-wallet-selector/core'), import('@near-wallet-selector/meteor-wallet')])
  .then(([core, meteor]) => core.setupWalletSelector({ network: 'testnet', modules: [meteor.setupMeteorWallet()] }))
  .catch((e) => { selectorPromise = null; throw e; }));

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
    }).catch((e) => setProblem({ ...explain(e), title: 'The wallet could not load', next: 'Reload the page. If it persists, Meteor Wallet may be down.' }));
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
    try { const w = await (await getSelector()).wallet<InjectedWallet>(WALLET.id); await w.signIn({ contractId: CONTRACT, methodNames: [] }); }
    catch (e) { setProblem(explain(e)); }
    finally { setConnecting(false); }
  }
  async function disconnect() {
    try { const w = await (await getSelector()).wallet(); await w.signOut(); } catch (e) { setProblem(explain(e)); }
    setAccount('');
  }
  /** Signs one function call. Calls without a deposit are signed by the function-call key Meteor Wallet issued at sign-in
   * (no pop-up); calls with a deposit open the Meteor Wallet pop-up for approval. */
  async function callContract(methodName: string, args: object, depositYocto: string, tgas = 30): Promise<Sent> {
    const [selector, { actionCreators }] = await Promise.all([getSelector(), import('@near-wallet-selector/core')]);
    const w = await selector.wallet();
    try {
      const outcome = await w.signAndSendTransaction({ receiverId: CONTRACT, actions: [actionCreators.functionCall(methodName, args, BigInt(tgas) * 10n ** 12n, BigInt(depositYocto))] });
      const o = outcome as { transaction?: { hash?: string }; transaction_outcome?: { id?: string } } | undefined;
      return { hash: o?.transaction?.hash ?? o?.transaction_outcome?.id ?? null, outcome };
    } catch (e) {
      // Landed and failed (a contract panic): the error carries the outcome, so follow its hash like any other.
      const landed = (e as { transaction_outcome?: { id?: string } } | null)?.transaction_outcome?.id;
      // The wallet sent it but its status lookup failed ("Transaction … doesn't exist"): keep following the hash.
      const fromMsg = String((e as Error)?.message ?? '').match(/Transaction (\w{43,44}) doesn't exist/)?.[1];
      if (landed || fromMsg) return { hash: (landed ?? fromMsg)!, outcome: null };
      throw e;
    }
  }
  return { account, problem, network, ready, connecting, connect, disconnect, callContract, setProblem };
}
export type Wallet = ReturnType<typeof useWallet>;
