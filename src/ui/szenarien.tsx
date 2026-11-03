import React, { useMemo, useState } from 'react';
import type { Plan } from '../model/types';
import { szenario, umsatzPuffer, type Ergebnis, type Szenario } from '../calc/plan';
import { Card, Help, fmtEUR, fmtPct } from './fields';
import { mdAktiv, nurSchaetzung } from '../model/zweck';

export const PRESETS: { id: string; name: string; sz: Szenario; text: string }[] = [
  { id: 'basis', name: 'Basis', sz: { umsatz: 0, kosten: 0 }, text: 'Ihre Eingaben unverändert' },
  { id: 'vorsichtig', name: 'Vorsichtig', sz: { umsatz: -0.1, kosten: 0.05 }, text: 'Umsatz −10 %, Kosten +5 %' },
  { id: 'pessimistisch', name: 'Pessimistisch', sz: { umsatz: -0.2, kosten: 0.1 }, text: 'Umsatz −20 %, Kosten +10 %' },
  { id: 'stress', name: 'Stresstest', sz: { umsatz: -0.3, kosten: 0.15 }, text: 'Umsatz −30 %, Kosten +15 %' },
  { id: 'optimistisch', name: 'Optimistisch', sz: { umsatz: 0.1, kosten: 0 }, text: 'Umsatz +10 %' },
];

const AMPEL_TEXT = { gruen: 'grün', gelb: 'gelb', rot: 'rot' } as const;
const kdTxt = (x: number) => (isFinite(x) ? fmtPct(x) : 'n. def.');

function Delta({ v, gutWennHoeher = true, pct = false }: { v: number; gutWennHoeher?: boolean; pct?: boolean }) {
  if (!isFinite(v) || Math.abs(v) < (pct ? 0.0005 : 0.5)) return null;
  const gut = gutWennHoeher ? v > 0 : v < 0;
  return <span className={gut ? 'delta-pos' : 'delta-neg'}> ({v > 0 ? '+' : ''}{pct ? (v * 100).toFixed(1).replace('.', ',') + ' Pp.' : fmtEUR(v)})</span>;
}

export function SzenarienStep({ plan, e }: { plan: Plan; e: Ergebnis }) {
  const [sz, setSz] = useState<Szenario>({ umsatz: -0.1, kosten: 0.05 });
  const r = useMemo(() => szenario(plan, sz), [plan, sz]);
  const alle = useMemo(() => PRESETS.map(p => ({ ...p, r: szenario(plan, p.sz) })), [plan]);
  const md = mdAktiv(plan), schaetzung = nurSchaetzung(plan);
  const puffer = useMemo(() => (md ? umsatzPuffer(plan, 0) : null), [plan, md]);
  const basis = { kd: e.kd.auslastung, liq: e.liq.tiefpunkt, be: e.jahre.map(j => j.betriebsergebnis) };
  const slider = (k: keyof Szenario, label: string) => <div className="slider">
    <label htmlFor={`sz-${k}`}><b>{label}</b></label><b data-testid={`sz-${k}-wert`}>{sz[k] > 0 ? '+' : ''}{Math.round(sz[k] * 100)} %</b>
    <input id={`sz-${k}`} aria-label={label} type="range" min={-50} max={50} step={5} value={Math.round(sz[k] * 100)} onChange={ev => setSz({ ...sz, [k]: Number(ev.target.value) / 100 })} />
  </div>;
  return <>
    <Help>Was passiert, wenn es anders kommt als geplant? Verändern Sie <b>Umsatz</b> (Menge in allen Geschäftsfeldern; Material passt sich an) und <b>Kosten</b> (laufende Kosten, Personal, a. o. Aufwand) prozentual. Ihre Eingaben werden dabei <b>nicht verändert</b> – die Szenarien sind nur eine Vorschau.</Help>
    <div className="sz-grid">
      <Card title="Szenario einstellen">
        <div className="presets">{PRESETS.map(p => <button key={p.id} className={`btn small ghost ${p.sz.umsatz === sz.umsatz && p.sz.kosten === sz.kosten ? 'on' : ''}`} onClick={() => setSz(p.sz)} title={p.text}>{p.name}</button>)}</div>
        {slider('umsatz', 'Umsatz')}
        {slider('kosten', 'Kosten')}
        <p className="muted small">Personalkosten werden über das Bruttogehalt verändert; Abschreibungen, Zinsen und private Kosten bleiben unverändert.</p>
      </Card>
      <Card title="Auswirkung (live)">
        <table className="tbl result vergleich" data-testid="sz-ergebnis"><thead><tr><th></th><th>Basis</th><th>Szenario</th></tr></thead><tbody>
          {md && <tr><td>KD-Auslastung (Plan-Jahr 2)</td><td>{kdTxt(basis.kd)} <span className={`dot ${e.kd.ampel}`} /></td><td className={r.ampel === 'rot' ? 'neg' : ''}><b>{kdTxt(r.kdAuslastung)}</b> · {AMPEL_TEXT[r.ampel]}{isFinite(r.kdAuslastung) && isFinite(basis.kd) && <Delta v={r.kdAuslastung - basis.kd} gutWennHoeher={false} pct />}</td></tr>}
          <tr><td>Liquidität Tiefpunkt</td><td>{fmtEUR(basis.liq)}</td><td className={r.liqMin < 0 ? 'neg' : ''}><b>{fmtEUR(r.liqMin)}</b> <span className="muted small">({r.liqMinMonat})</span><Delta v={r.liqMin - basis.liq} /></td></tr>
          {[0, 1, 2].map(j => <tr key={j}><td>Betriebsergebnis Jahr {j + 1}</td><td>{fmtEUR(basis.be[j])}</td><td className={r.be[j] < 0 ? 'neg' : ''}><b>{fmtEUR(r.be[j])}</b><Delta v={r.be[j] - basis.be[j]} /></td></tr>)}
        </tbody></table>
        {r.liqFehler && <div className="fehler-box" role="alert" data-testid="sz-fehler"><b>✕ Fehler im Szenario:</b> Die Liquidität wird in {r.liqNegMonate} von 36 Monaten negativ (Tiefpunkt {fmtEUR(r.liqMin)} im {r.liqMinMonat}). In diesem Fall {schaetzung ? 'wäre die Liquidität nicht gesichert' : 'wäre der Plan nicht einreichungsfähig'} – planen Sie Reserven (Eigenmittel, Kontokorrent, geringere Entnahmen) ein. <span className="muted small">Szenarien sind nur eine Vorschau und sperren den Basisplan nicht.</span></div>}
        {md && <p className="kpi-inline">Umsatzpuffer: {puffer === null ? <b className="neg">KD bereits im Basisfall nicht gegeben.</b> : puffer <= -1 ? <b>KD bleibt auch ohne Umsatz gegeben.</b> : <>Der Umsatz darf um bis zu <b>{Math.floor(-puffer * 100)} %</b> sinken, bevor die KD-Ampel rot wird (Kosten unverändert).</>}</p>}
      </Card>
    </div>
    <Card title="Szenarien im Vergleich">
      <div className="scroll"><table className="tbl result"><thead><tr><th>Szenario</th><th>Annahme</th>{md && <><th>KD-Auslastung</th><th>Ampel</th></>}<th>Liquidität min.</th><th>BE Jahr 1</th><th>BE Jahr 2</th><th>BE Jahr 3</th></tr></thead><tbody>
        {alle.map(a => <tr key={a.id}><td><b>{a.name}</b></td><td className="muted">{a.text}</td>{md && <><td>{kdTxt(a.r.kdAuslastung)}</td><td><span className={`dot ${a.r.ampel}`} /> {AMPEL_TEXT[a.r.ampel]}</td></>}<td className={a.r.liqFehler ? 'neg' : ''}>{fmtEUR(a.r.liqMin)}{a.r.liqFehler && <span className="sz-fehler"> · Fehler im Szenario</span>}</td>{a.r.be.map((v, i) => <td key={i} className={v < 0 ? 'neg' : ''}>{fmtEUR(v)}</td>)}</tr>)}
      </tbody></table></div>
    </Card>
  </>;
}
