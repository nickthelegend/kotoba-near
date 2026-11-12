import Head from './Head';
import { MarketCard } from './Board';
import { Problem, State, useMarkets, useNow } from './ui';
import { RUN } from './lib';
import type { Wallet } from './wallet';

export default function Resolved({ wallet, desktop }: { wallet: Wallet; desktop: boolean }) {
  const { markets, problem, loading, reload, at } = useMarkets();
  const now = useNow();
  const done = (markets ?? []).filter((m) => m.result !== null).sort((a, b) => b.close_ns - a.close_ns);
  const runs = RUN.steps.filter((s) => s.outlayer);
  return <div className={desktop ? 'web-page' : 'ph-page'}>
    <Head wallet={wallet} desktop={desktop} onRefresh={reload} refreshing={loading} at={at} now={now} />
    <header className="page-title">
      <h1>Resolved</h1>
      <p>Every market here was counted by a pinned program inside an Intel TDX enclave. {runs.filter((r) => r.outlayer!.attestation.ok).length} of {runs.length} recorded OutLayer runs pass every attestation check; open one to re-check it in your browser.</p>
    </header>
    {problem && !markets ? <Problem x={problem} onRetry={reload} />
      : !markets ? <div className={desktop ? 'web-grid' : 'stack'} aria-busy="true">{[0, 1].map((i) => <div key={i} className="mcard skeleton" />)}</div>
      : done.length === 0 ? <State kind="empty" art="gavel" title="Nothing has settled yet">Markets resolve after the official transcript is published.</State>
      : <div className={desktop ? 'web-grid' : 'stack'}>{done.map((m) => <MarketCard key={m.id} m={m} now={now} />)}</div>}
  </div>;
}
