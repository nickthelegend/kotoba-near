import { Link } from '../ui';
import { RunCard } from '../MarketPage';
import { DEPLOYMENT, runsFor } from '../lib';
import { type KEvent, fmtDate, label, speaker, txURL, accountURL, CONTRACT } from './data';

const STEPS = (close: Date, deadline: Date) => [
  ['Trading closes', `${fmtDate(close, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}, before the speaker starts. Resting orders can still be cancelled.`],
  ['Anyone resolves', 'After the Fed publishes the transcript, anyone can call resolve with a 0.1 NEAR bond. The contract asks OutLayer to run the pinned counting program.'],
  ['The count runs sealed', 'Inside an Intel TDX enclave, the program downloads the official PDF, hashes it and counts whole-word matches. The answer comes back signed.'],
  ['15 minutes to challenge', 'Anyone can post a bond to rerun the same program. A different count pays the challenger; the rerun is final.'],
  ['Winners claim', `Each winning share pays 0.001 NEAR. If nothing settles by ${fmtDate(deadline)}, every share redeems for half.`],
];

export function Rules({ event }: { event: KEvent }) {
  const who = speaker(event.title);
  const close = new Date(event.closeMs);
  const deadline = new Date(event.markets[0].deadline_ns / 1e6);
  const january = runsFor('fomc-2026-01-inflation-40').find(r => r.method === 'resolve' && r.outlayer?.attestation);
  return (
    <div className="k-rules">
      <section className="k-card">
        <h2 className="k-h2">How each word resolves</h2>
        <p className="k-lede">A word resolves <b className="yes">Yes</b> if the official Federal Reserve transcript of the {fmtDate(event.date, { month: 'long', day: 'numeric', year: 'numeric' })} press conference contains it at least the stated number of times. Otherwise it resolves <b className="no">No</b>.</p>
        <ul className="k-rule-list">
          <li><b>Whole words only.</b> Case does not matter; “AI” never matches inside “said”, and “tariffs” does not count “tariff”.</li>
          <li><b>The whole transcript counts,</b> including reporters' questions, not only {who}. That is what the pinned program counts today.</li>
          <li><b>Source:</b> <a href={event.source} target="_blank" rel="noreferrer">the official PDF on federalreserve.gov ↗</a>. It is published after the conference{event.id === 'fed-2027-01-27' ? '; the January date is the Fed’s tentative 2027 calendar' : ''}.</li>
        </ul>
        <table className="k-rule-table">
          <thead><tr><th>Word</th><th>Resolves Yes if said</th></tr></thead>
          <tbody>{event.markets.map(m => <tr key={m.id}><td>{label(m)}</td><td>{m.threshold === 1 ? 'at least once' : `${m.threshold} or more times`}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="k-card">
        <h2 className="k-h2">From close to payout</h2>
        <ol className="k-timeline">
          {STEPS(close, deadline).map(([t, d], i) => <li key={t}><span>{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>)}
        </ol>
      </section>

      <section className="k-card k-seal">
        <div className="k-seal-head">
          <div>
            <h2 className="k-h2">The seal, checked in your browser</h2>
            <p className="k-muted">December has not happened yet, so here is a market that already settled the same way: the January 28, 2026 conference (Powell was chair then). “Inflation” 40 or more times resolved Yes with a count of 40. Your browser re-checks the enclave evidence live.</p>
          </div>
        </div>
        {january && <RunCard run={january} label="Settled January 28, 2026 market · previous contract" />}
        <dl className="k-pins">
          <div><dt>Pinned program</dt><dd><code>{DEPLOYMENT.oracle_sha256}</code></dd></div>
          <div><dt>Program file</dt><dd><a href={DEPLOYMENT.oracle_url} target="_blank" rel="noreferrer">FastFS ↗</a></dd></div>
          <div><dt>Market contract</dt><dd><a href={accountURL(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT} ↗</a></dd></div>
          {january && <div><dt>Resolution tx</dt><dd><a href={txURL(january.tx)} target="_blank" rel="noreferrer">{january.tx.slice(0, 10)}… ↗</a></dd></div>}
        </dl>
        <p className="k-muted small">The contract accepts OutLayer's callback; the Intel quote is verified off-chain by the browser checks above and the SDK. <Link to="/market/fomc-2026-01-inflation-40">See the full settled market with all 40 hits highlighted →</Link></p>
      </section>
    </div>
  );
}
