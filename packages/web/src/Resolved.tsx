import Head from './Head';
import { MarketCard } from './Board';
import { State, useMarkets, useNow } from './ui';
import { RUN, isOpen } from './lib';
import type { Wallet } from './wallet';

export default function Resolved({ wallet, desktop }: { wallet: Wallet; desktop: boolean }) {
  const { markets, error, loading, reload } = useMarkets();
  const now = useNow();
  const done = (markets ?? []).filter((m) => !isOpen(m, now)).sort((a, b) => b.close_ns - a.close_ns);
  const runs = RUN.steps.filter((s) => s.outlayer);
  return <div className={desktop ? 'web-page' : 'ph-page'}>
    <Head wallet={wallet} desktop={desktop} onRefresh={reload} refreshing={loading} />
    <header className="page-title">
      <h1>Resolved</h1>
      <p>Every market here was settled by a pinned program inside an Intel TDX enclave. {runs.filter((r) => r.outlayer!.attestation.ok).length} of {runs.length} recorded OutLayer runs pass every attestation check; open one to re-check it in your browser.</p>
    </header>
    {error && !markets ? <State kind="error" title="Could not read the contract" action={<button className="pill-light" onClick={reload}>Retry</button>}>{error}</State>
      : !markets ? <State kind="loading" title="Reading markets from NEAR testnet…" />
      : done.length === 0 ? <State kind="empty" title="Nothing has settled yet">Markets resolve after the official transcript is published.</State>
      : <div className={desktop ? 'web-grid' : 'stack'}>{done.map((m) => <MarketCard key={m.id} m={m} now={now} />)}</div>}
  </div>;
}
