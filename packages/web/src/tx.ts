// One path for every transaction: preflight (wallet, network, balance), optimistic update, wallet signature,
// pending toast with the NearBlocks link, confirmation from the RPC, then refresh, or rollback with the real reason.
import { txUrl, viewAccount, waitForTx } from './lib';
import { TxFailed, explain, spendableYocto, txFailure, upfrontYocto, type Explained } from './errors';
import { CHAIN_CHANGED, refreshBalance, refreshMarkets, toast } from './store';
import type { Wallet } from './wallet';

export type TxRequest = {
  method: string; args: Record<string, unknown>; depositYocto: bigint; tgas: number;
  /** "Buy 10 YES · “inflation”" */
  label: string;
  /** Applied before the wallet opens and undone if anything fails. */
  optimistic?: { apply: () => void; rollback: () => void; confirm: () => void; submitted?: (hash: string) => void };
  onStage?: (stage: TxStage) => void;
  /** Returns true while the caller shows the outcome itself; then a failure needs no toast. */
  inline?: () => boolean;
};
export type TxStage = { step: 'checking' | 'signing' | 'pending' | 'confirmed' | 'failed'; tx?: string; problem?: Explained };
export type TxResult = { ok: true; tx: string | null } | { ok: false; problem: Explained };

const fmt = (yocto: bigint) => (Number(yocto / 10n ** 18n) / 1e6).toFixed(4);

/** Checks that can fail before anything is signed. Returns the problem, or null when the transaction can go. */
export async function preflight(wallet: Wallet, depositYocto: bigint, tgas: number): Promise<Explained | null> {
  if (!wallet.account) return explain(new Error('Wallet not signed in'));
  if (wallet.network) return wallet.network;
  try {
    const a = await viewAccount(wallet.account);
    const have = spendableYocto(a.amount, a.storage_usage);
    const need = upfrontYocto(depositYocto, tgas);
    if (have < need) return { ...explain(new Error(`does not have enough balance ${fmt(have)} for operation costing ${fmt(need)}`)), detail: `You have ${fmt(have)} NEAR spendable, and this needs ${fmt(need)} NEAR up front: ${fmt(depositYocto)} NEAR deposit plus ${tgas} Tgas of prepaid gas (unused gas comes back).` };
  } catch (e) { return explain(e); }
  return null;
}

export async function runTx(wallet: Wallet, r: TxRequest): Promise<TxResult> {
  const stage = (s: TxStage) => r.onStage?.(s);
  stage({ step: 'checking' });
  const pre = await preflight(wallet, r.depositYocto, r.tgas);
  if (pre) { stage({ step: 'failed', problem: pre }); return { ok: false, problem: pre }; }

  const deposit = r.depositYocto > 0n;
  const id = toast.push({ tone: 'pending', title: r.label, body: deposit ? 'Approve it in the Meteor Wallet window.' : 'Signing with this site’s Meteor Wallet key…' });
  r.optimistic?.apply();
  stage({ step: 'signing' });
  let hash: string | null = null;
  try {
    const sent = await wallet.callContract(r.method, r.args, r.depositYocto.toString(), r.tgas);
    hash = sent.hash;
    if (hash) r.optimistic?.submitted?.(hash);
    stage({ step: 'pending', tx: hash ?? undefined });
    toast.update(id, { body: 'Sent. Waiting for NEAR testnet to execute it…', tx: hash ?? undefined });
    const executed = (sent.outcome as { status?: unknown } | null)?.status !== undefined;
    if (!hash && !executed) throw new Error('The wallet returned no transaction hash, so the result cannot be confirmed. Check your NearBlocks history.');
    // The function-call-key path returns the executed outcome; the popup path returns only a hash we must follow.
    const failure = executed ? txFailure(sent.outcome) : await waitForTx(hash!, wallet.account);
    if (failure) throw new TxFailed(failure, hash ?? '');
    await Promise.all([refreshMarkets(), refreshBalance(wallet.account)]);
    dispatchEvent(new Event(CHAIN_CHANGED));
    r.optimistic?.confirm();
    stage({ step: 'confirmed', tx: hash ?? undefined });
    toast.update(id, { tone: 'success', body: 'Confirmed on NEAR testnet.', tx: hash ?? undefined });
    return { ok: true, tx: hash };
  } catch (e) {
    let problem = explain(e);
    // The RPC timed out on broadcast but handed us the hash: follow it instead of guessing.
    if (problem.kind === 'tx_timeout' && problem.tx && !hash) {
      hash = problem.tx;
      toast.update(id, { body: 'The RPC timed out. Checking whether it landed…', tx: hash });
      try {
        const failure = await waitForTx(hash, wallet.account);
        if (!failure) {
          await Promise.all([refreshMarkets(), refreshBalance(wallet.account)]);
          dispatchEvent(new Event(CHAIN_CHANGED));
          r.optimistic?.confirm();
          stage({ step: 'confirmed', tx: hash });
          toast.update(id, { tone: 'success', body: 'Confirmed on NEAR testnet.', tx: hash });
          return { ok: true, tx: hash };
        }
        problem = explain(new TxFailed(failure, hash));
      } catch (again) { problem = explain(again); }
    }
    r.optimistic?.rollback();
    if (!problem.tx && hash && problem.kind !== 'user_rejected') problem.tx = hash;
    stage({ step: 'failed', tx: problem.tx, problem });
    if (r.inline?.()) toast.dismiss(id);
    else toast.update(id, { tone: 'error', title: problem.title, body: `${r.label} · ${problem.next}`, tx: problem.tx });
    refreshBalance(wallet.account);
    return { ok: false, problem };
  }
}

export { txUrl };
