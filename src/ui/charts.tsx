import React from 'react';
import { fmtEUR } from './fields';

const W = 640, H = 240, PL = 64, PR = 12, PT = 12, PB = 30;

function skala(min: number, max: number) {
  if (min === max) { max = min + 1; }
  const span = max - min, step0 = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * step0).find(s => span / s <= 5) ?? step0 * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  return { lo, hi, ticks };
}
const kurz = (v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' T€' : v.toLocaleString('de-DE') + ' €');

export function LineChart({ labels, series, title, nullLinie = true }: { labels: string[]; series: { name: string; data: number[]; color: string; dash?: boolean; area?: boolean }[]; title: string; nullLinie?: boolean }) {
  const all = series.flatMap(s => s.data);
  const { lo, hi, ticks } = skala(Math.min(0, ...all), Math.max(0, ...all));
  const x = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, labels.length - 1);
  const y = (v: number) => PT + ((hi - v) * (H - PT - PB)) / (hi - lo || 1);
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map(t => <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="grid" /><text x={PL - 6} y={y(t) + 4} textAnchor="end" className="ax">{kurz(t)}</text></g>)}
        {nullLinie && <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} className="zero" />}
        {[12, 24].map(m => m < labels.length && <line key={m} x1={x(m - 0.5)} x2={x(m - 0.5)} y1={PT} y2={H - PB} className="yearsep" />)}
        {labels.map((l, i) => (i % 3 === 0 ? <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="ax">{l}</text> : null))}
        {series.map(s => {
          const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          return <g key={s.name}>
            {s.area && <polygon points={`${x(0)},${y(0)} ${pts} ${x(s.data.length - 1)},${y(0)}`} fill={s.color} opacity={0.12} />}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dash ? '5 4' : undefined} />
            {s.data.map((v, i) => v < 0 && s.area ? <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="#c62828" /> : null)}
          </g>;
        })}
      </svg>
      <div className="legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </figure>
  );
}

export function BarChart({ groups, series, title }: { groups: string[]; series: { name: string; data: number[]; color: string }[]; title: string }) {
  const all = series.flatMap(s => s.data);
  const { lo, hi, ticks } = skala(Math.min(0, ...all), Math.max(0, ...all));
  const y = (v: number) => PT + ((hi - v) * (H - PT - PB)) / (hi - lo || 1);
  const gw = (W - PL - PR) / groups.length, bw = Math.min(46, (gw * 0.7) / series.length);
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map(t => <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="grid" /><text x={PL - 6} y={y(t) + 4} textAnchor="end" className="ax">{kurz(t)}</text></g>)}
        <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} className="zero" />
        {groups.map((g, gi) => {
          const x0 = PL + gi * gw + (gw - bw * series.length) / 2;
          return <g key={g}>
            {series.map((s, si) => { const v = s.data[gi]; return <g key={s.name}><rect x={x0 + si * bw} y={Math.min(y(v), y(0))} width={bw - 4} height={Math.abs(y(v) - y(0))} fill={s.color} rx={3}><title>{`${s.name} ${g}: ${fmtEUR(v)}`}</title></rect>
              <text x={x0 + si * bw + (bw - 4) / 2} y={Math.min(y(v), y(0)) - 4} textAnchor="middle" className="val">{kurz(Math.round(v))}</text></g>; })}
            <text x={PL + gi * gw + gw / 2} y={H - 10} textAnchor="middle" className="ax">{g}</text>
          </g>;
        })}
      </svg>
      <div className="legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </figure>
  );
}

export function StackBar({ items, title }: { items: { name: string; value: number }[]; title: string }) {
  const farben = ['#005274', '#0089c1', '#5aa6d6', '#8cc4e8', '#f18c00', '#c97b2a', '#7a8a99', '#a3b1bf'];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <div className="stack">{items.map((it, i) => <div key={it.name} style={{ width: `${(it.value / total) * 100}%`, background: farben[i % farben.length] }} title={`${it.name}: ${fmtEUR(it.value)}`} />)}</div>
      <ul className="stacklegend">{items.map((it, i) => <li key={it.name}><i style={{ background: farben[i % farben.length] }} />{it.name}<b>{fmtEUR(it.value)}</b><span>{Math.round((it.value / total) * 100)} %</span></li>)}</ul>
    </figure>
  );
}
