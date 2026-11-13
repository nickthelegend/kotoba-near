import { useMemo, useRef, useState } from 'react';

export type Series = { id: string; name: string; color: string; points: { t: number; v: number }[]; now: number | null };
const RANGES: [string, number][] = [['1H', 3600e3], ['6H', 6 * 3600e3], ['1D', 86400e3], ['ALL', Infinity]];

/** Step chart of real fill prices: each line holds its last trade until the next one, then ends at the live price. */
export function PriceChart({ series: input, height = 300, compact = false }: { series: Series[]; height?: number; compact?: boolean }) {
  // Colours follow the lines on screen, so two shown words never share one.
  const series = input.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }));
  const [range, setRange] = useState('ALL');
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const W = 760, H = height, padR = 44, padT = 14, padB = 26;
  const now = Date.now();
  const span = RANGES.find(r => r[0] === range)![1];
  const all = series.flatMap(s => s.points.map(p => p.t));
  const first = all.length ? Math.min(...all) : now - 3600e3;
  const t0 = Math.max(first, now - span) - (span === Infinity ? Math.max(60e3, (now - first) * 0.02) : 0);
  const x = (t: number) => ((t - t0) / (now - t0)) * (W - padR);
  // Autoscale like Polymarket: fit the visible prices with some headroom, in 10-point steps.
  const vals = series.flatMap(s => [...s.points.filter(p => p.t >= t0).map(p => p.v), ...(s.now === null ? [] : [s.now])]);
  const lo = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 6) / 10) * 10) : 0;
  const hi = vals.length ? Math.min(100, Math.ceil((Math.max(...vals) + 6) / 10) * 10) : 100;
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);

  const paths = useMemo(() => series.map(s => {
    const pts = s.points.filter(p => p.t >= t0);
    const before = [...s.points].reverse().find(p => p.t < t0);
    const start = before ? [{ t: t0, v: before.v }] : [];
    const seq = [...start, ...pts];
    if (!seq.length && s.now === null) return { s, d: '', end: null as null | { x: number; y: number; v: number } };
    const end = s.now ?? seq.at(-1)!.v;
    const full = [...seq, { t: now, v: end }];
    let d = `M${x(full[0].t).toFixed(1)},${y(full[0].v).toFixed(1)}`;
    for (let i = 1; i < full.length; i++) d += `H${x(full[i].t).toFixed(1)}V${y(full[i].v).toFixed(1)}`;
    return { s, d, end: { x: x(now), y: y(end), v: end } };
  }), [series, t0, now]);

  const valueAt = (s: Series, t: number) => {
    const p = [...s.points].reverse().find(p => p.t <= t);
    return t >= now - 1000 ? s.now ?? p?.v ?? null : p?.v ?? null;
  };
  const hoverT = hover === null ? null : t0 + (hover / (W - padR)) * (now - t0);
  const step = hi - lo > 50 ? 20 : 10;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map(f => t0 + f * (now - t0));
  const fmtT = (t: number) => (now - t0 > 2 * 86400e3 ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

  return (
    <div className={'k-chart' + (compact ? ' compact' : '')}>
      {!compact && (
        <div className="k-chart-legend">
          {series.map(s => {
            const v = hoverT === null ? s.now : valueAt(s, hoverT);
            return <span key={s.id}><i style={{ background: s.color }} />{s.name} <b>{v === null ? '—' : `${v}%`}</b></span>;
          })}
        </div>
      )}
      <svg ref={box} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chance over time, from real fills on NEAR testnet"
        onMouseMove={e => { const r = box.current!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(px >= 0 && px <= W - padR ? px : null); }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={0} x2={W - padR} y1={y(v)} y2={y(v)} className="k-gridline" />
            <text x={W - padR + 8} y={y(v) + 4} className="k-axis">{v}%</text>
          </g>
        ))}
        {!compact && timeTicks.slice(1, 4).map(t => <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="k-axis">{fmtT(t)}</text>)}
        {paths.map(({ s, d, end }) => d && (
          <g key={s.id}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={compact ? 2 : 2.25} strokeLinejoin="round" />
            {end && <circle cx={end.x} cy={end.y} r={compact ? 3 : 4} fill={s.color} className="k-pulse" />}
          </g>
        ))}
        {hover !== null && hoverT !== null && (
          <g>
            <line x1={hover} x2={hover} y1={padT} y2={H - padB} className="k-cross" />
            {series.map(s => { const v = valueAt(s, hoverT); return v === null ? null : <circle key={s.id} cx={hover} cy={y(v)} r={4} fill="#fff" stroke={s.color} strokeWidth={2} />; })}
            <text x={Math.min(Math.max(hover, 40), W - padR - 40)} y={padT - 2} textAnchor="middle" className="k-axis strong">{new Date(hoverT).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</text>
          </g>
        )}
      </svg>
      {!compact && (
        <div className="k-chart-foot">
          <span>Real fills on NEAR testnet</span>
          <div className="k-ranges">{RANGES.map(([r]) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}</div>
        </div>
      )}
    </div>
  );
}

export const COLORS = ['#ff5a4e', '#2f6fed', '#14a05b', '#e8a317', '#0ea5a4', '#64748b'];
