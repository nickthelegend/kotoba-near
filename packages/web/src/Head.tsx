import { Freshness, Icon, Link, useBalance, Wordmark } from './ui';
import { short } from './lib';
import type { Wallet } from './wallet';

/** Balance header: the connected account's live NEAR testnet balance, or a Connect pill. */
export default function Head({ wallet, desktop, onRefresh, refreshing, at, now }: { wallet: Wallet; desktop: boolean; onRefresh?: () => void; refreshing?: boolean; at?: number; now?: number }) {
  const { balance, error } = useBalance(wallet.account);
  const value = !wallet.account ? null : wallet.network ? 'Wrong network' : error && balance === null ? 'Unavailable' : balance === null ? '…' : balance.toFixed(3);
  const [whole, frac] = value && /^\d/.test(value) ? value.split('.') : [value, ''];
  const amount = value === null
    ? <p className="bal bal-empty">Not connected</p>
    : <p className="bal" title={wallet.network?.detail || error || undefined}>{whole}{frac && <span className="bal-frac">.{frac}</span>}{/^\d/.test(value) && <small> NEAR</small>}</p>;
  const action = wallet.account
    ? <Link to="/you" className="pill-light">{short(wallet.account, 10, 6)}</Link>
    : <button className="pill-light" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting}>{wallet.connecting ? 'Connecting…' : 'Connect'}</button>;

  if (desktop) return <header className="web-head">
    <div className="web-head-row">
      <Link to="/" className="wm-text" aria-label="Kotoba home">Kotoba<i>.</i></Link>
      <div className="web-head-tools">
        {at && now ? <Freshness at={at} loading={refreshing} now={now} /> : <span className="net"><i className="live-dot" />Testnet</span>}
        {onRefresh && <button className="icon-round" onClick={onRefresh} aria-label="Refresh markets" disabled={refreshing}><Icon name="refresh" size={16} /></button>}
      </div>
    </div>
    <div className="web-bal">
      <div><p className="lbl">{wallet.account ? 'Your NEAR testnet balance' : 'Wallet'}</p>{amount}</div>
      {wallet.account ? <Link to="/you" className="pill-ink">Positions</Link> : <button className="pill-ink" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting}>{wallet.connecting ? 'Waiting for MyNearWallet…' : 'Connect wallet'}</button>}
    </div>
  </header>;

  return <header className="ph-head">
    <div className="ph-top">
      <Link to="/" className="ph-logo" aria-label="Kotoba home"><Wordmark /></Link>
      <span className="net"><i className="live-dot" />Testnet</span>
    </div>
    <div className="ph-bal">
      <div><p className="lbl">{wallet.account ? 'Balance' : 'Wallet'}</p>{amount}</div>
      {action}
    </div>
  </header>;
}
