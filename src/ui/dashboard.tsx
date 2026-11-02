import React, { useState } from 'react';
import type { Plan } from '../model/types';
import type { Ergebnis } from '../calc/plan';
import { jahr, sum, privatKostenMonat } from '../calc/plan';
import { Card, fmtEUR, fmtPct, Help } from './fields';
import { LineChart, BarChart, StackBar } from './charts';

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: 'pos' | 'neg' | 'warn' }) {
  return <div className={`tile ${tone ?? ''}`}><div className="tl">{label}</div><div className="tv">{value}</div>{sub && <div className="ts">{sub}</div>}</div>;
}

function periodTable(e: Ergebnis, rows: [string, number[], string?][], ansicht: 'jahr' | 'monat', stand = new Set<string>()) {
  const cols = ansicht === 'jahr' ? ['Jahr 1', 'Jahr 2', 'Jahr 3'] : e.labels;
  const val = (l: string, a: number[]) => (ansicht === 'jahr' ? [1, 2, 3].map(j => (stand.has(l) ? a[j * 12 - 1] : jahr(a, j))) : a);
  return <div className="scroll"><table className={`tbl result ${ansicht === 'monat' ? 'compact' : ''}`}><thead><tr><th>Position</th>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>
    {rows.map(([l, a, cls]) => <tr key={l} className={cls}><td>{l}</td>{val(l, a).map((v, i) => <td key={i} className={v < -0.005 ? 'neg' : ''}>{fmtEUR(v)}</td>)}</tr>)}
  </tbody></table></div>;
}

export function Dashboard({ plan, e, gotoStep }: { plan: Plan; e: Ergebnis; gotoStep: (id: string) => void }) {
  const [ansicht, setAnsicht] = useState<'jahr' | 'monat'>('jahr');
  const kd = e.kd, kapg = plan.einstellungen.rechtsform === 'KAPG';
  const ampelText = kd.ampel === 'gruen' ? 'Kapitaldienstfähigkeit gegeben' : kd.ampel === 'gelb' ? 'gegeben, aber knapp' : 'nicht gegeben';
  const neg = (a: number[]) => a.map(x => -x);
  const L = e.liq;
  const privatItems = plan.gruender.flatMap(g => g.privat).reduce((m, pp) => { m.set(pp.gruppe, (m.get(pp.gruppe) ?? 0) + pp.werte[0]); return m; }, new Map<string, number>());
  const st1 = e.steuerJahre[0];
  const svSt = kapg ? 0 : st1.personen.reduce((s, x) => s + x.sv + x.steuer, 0) / 12;
  const privat = [...privatItems.entries()].map(([name, value]) => ({ name, value })).filter(x => x.value > 0);
  if (svSt > 0) privat.push({ name: 'KV/PV, Rente, ESt (berechnet)', value: svSt });
  const d1 = plan.darlehen[0];
  return <div className="dashboard">
    <div className="tiles">
      <Tile label="Umsatz Jahr 1 / 2 / 3" value={fmtEUR(e.jahre[0].umsatz)} sub={<>{fmtEUR(e.jahre[1].umsatz)} · {fmtEUR(e.jahre[2].umsatz)}</>} />
      <Tile label="Ergebnis vor Steuern J1 / J2 / J3" value={fmtEUR(e.jahre[0].ergebnisVorSteuern)} tone={e.jahre[0].ergebnisVorSteuern < 0 ? 'neg' : undefined} sub={<>{fmtEUR(e.jahre[1].ergebnisVorSteuern)} · {fmtEUR(e.jahre[2].ergebnisVorSteuern)}</>} />
      <Tile label="Liquiditätstiefpunkt" value={fmtEUR(L.tiefpunkt)} tone={L.tiefpunkt < 0 ? 'neg' : 'pos'} sub={<>im {e.labels[L.tiefpunktIdx]} · Ende J3 {fmtEUR(L.kumuliert[35])}</>} />
      <Tile label="Kapitalbedarf / Finanzierung" value={fmtEUR(e.kapitalbedarf.summe)} sub={<>Finanzierung {fmtEUR(e.finanzierung)}{e.finanzierung < e.kapitalbedarf.summe && <span className="neg"> (Lücke {fmtEUR(e.kapitalbedarf.summe - e.finanzierung)})</span>}</>} />
      <Tile label={kapg ? 'Ausschüttungen Jahr 2' : 'Ø Privatentnahme / Monat (J1)'} value={kapg ? fmtEUR(kd.ausschuettung2) : fmtEUR(jahr(e.privatentnahme, 1) / 12)} sub={kapg ? 'aus der Gesellschaft' : 'inkl. KV/PV, Rente, ESt abzgl. Einnahmen'} />
    </div>

    <section className={`card kd ${kd.ampel}`}>
      <div className="kd-head">
        <div className={`ampel ${kd.ampel}`} aria-label={`Ampel ${kd.ampel}`}><i className="r" /><i className="y" /><i className="g" /></div>
        <div>
          <h3>Kapitaldienstfähigkeit (Plan-Jahr 2): {ampelText}</h3>
          <div className="kd-kpis">
            <span>Auslastung <b>{isFinite(kd.auslastung) ? fmtPct(kd.auslastung) : 'n. def.'}</b> (Grenze {fmtPct(plan.params.kdGrenze, 0)})</span>
            <span>KD-Grenze <b>{fmtEUR(kd.grenze)}</b></span>
            <span>Kapitaldienst Darlehen 1 <b>{fmtEUR(kd.kapitaldienst)}</b></span>
            <span>max. tragbarer Darlehensbetrag <b>{fmtEUR(Math.floor(kd.maxDarlehen / 100) * 100)}</b>{kd.maxDarlehen > (plan.einstellungen.folgedarlehen ? 45000 : 35000) && <em className="muted"> (Förderhöchstbetrag {plan.einstellungen.folgedarlehen ? '45.000' : '35.000'} €)</em>}</span>
          </div>
          <div className="bar"><div style={{ width: `${Math.min(100, (isFinite(kd.auslastung) ? kd.auslastung : 1.2) / 1.2 * 100)}%` }} /><span className="mark" style={{ left: `${plan.params.kdGelb / 1.2 * 100}%` }} /><span className="mark red" style={{ left: `${plan.params.kdGrenze / 1.2 * 100}%` }} /></div>
        </div>
      </div>
      <details><summary>Was bedeutet das? Rechenweg anzeigen</summary>
        <p className="muted">Die Bank prüft, ob das Unternehmen im zweiten Planjahr genug erwirtschaftet, um nach Ihrer Lebenshaltung, Sozialversicherung und Steuern den Kapitaldienst (Zins + Tilgung) des Mikrodarlehens zu tragen. Der Kapitaldienst darf höchstens {fmtPct(plan.params.kdGrenze, 0)} der verbleibenden Mittel (KD-Grenze) betragen.</p>
        <table className="tbl result"><tbody>
          <tr><td>Betriebsergebnis Plan-Jahr 2</td><td>{fmtEUR(kd.be2)}</td></tr>
          <tr><td>+ Abschreibungen</td><td>{fmtEUR(kd.afa2)}</td></tr>
          <tr><td>+ Zinsen Mikrodarlehen</td><td>{fmtEUR(kd.zinsD1)}</td></tr>
          <tr className="sum"><td>= Mittelzufluss</td><td>{fmtEUR(kd.zufluss)}</td></tr>
          {!kapg && kd.entnahmenDetail.map(x => <React.Fragment key={x.name}>
            <tr><td>− Private Kosten {x.name} (12 Monate)</td><td>{fmtEUR(-x.privat)}</td></tr>
            <tr><td>− Kranken-/Pflege-/Rentenversicherung {x.name}</td><td>{fmtEUR(-x.sv)}</td></tr>
            <tr><td>− Einkommensteuer, Soli, KiSt {x.name}</td><td>{fmtEUR(-x.est)}</td></tr></React.Fragment>)}
          {kapg && <tr><td>− Ausschüttungen</td><td>{fmtEUR(-kd.ausschuettung2)}</td></tr>}
          <tr><td>− Gewerbesteuer</td><td>{fmtEUR(-kd.gewSt2)}</td></tr>
          {kapg && <tr><td>− Körperschaftsteuer</td><td>{fmtEUR(-kd.kst2)}</td></tr>}
          <tr><td>− Kapitaldienst weiterer / bestehender Kredite</td><td>{fmtEUR(-kd.kdAndere)}</td></tr>
          <tr className="sum"><td>= KD-Grenze</td><td>{fmtEUR(kd.grenze)}</td></tr>
          <tr><td>Kapitaldienst Mikrodarlehen ({fmtEUR(d1?.betrag ?? 0)}, {d1?.art === 'annuitaet' ? 'Annuität' : 'Tilgungsdarlehen'}): Zins {fmtEUR(kd.zinsD1, 2)} + Tilgung {fmtEUR(kd.tilgD1, 2)}</td><td>{fmtEUR(kd.kapitaldienst)}</td></tr>
          <tr className="sum"><td>Auslastung = Kapitaldienst / KD-Grenze</td><td>{isFinite(kd.auslastung) ? fmtPct(kd.auslastung) : 'nicht definiert'}</td></tr>
        </tbody></table>
        {kapg && kd.tragfaehigkeit.map(t => <p key={t.name} className={t.netto < t.bedarf ? 'neg' : 'pos'}>Private Tragfähigkeit {t.name}: netto verfügbar {fmtEUR(t.netto)} p. a. gegenüber privaten Kosten {fmtEUR(t.bedarf)} p. a.</p>)}
        <p className="muted small">Max. tragbarer Betrag: Betrag, bei dem der Kapitaldienst genau {fmtPct(plan.params.kdGrenze, 0)} der KD-Grenze erreicht (gleiche Konditionen; die geringere Steuer durch höhere Zinsen ist vernachlässigt).</p>
      </details>
    </section>

    {e.warnungen.length > 0 && <Card title={`Hinweise (${e.warnungen.length})`}><ul className="warnlist">
      {e.warnungen.map((w, i) => <li key={i} className={w.schwer ? 'schwer' : ''}><span>{w.text}</span><button className="btn link" onClick={() => gotoStep(w.schritt === 'ergebnis' ? 'privat' : w.schritt)}>zur Eingabe →</button></li>)}
    </ul></Card>}

    <div className="charts">
      <Card><BarChart title="Umsatz und Ergebnis" groups={['Jahr 1', 'Jahr 2', 'Jahr 3']} series={[{ name: 'Umsatz netto', data: e.jahre.map(j => j.umsatz), color: '#154c79' }, { name: 'Ergebnis vor Steuern', data: e.jahre.map(j => j.ergebnisVorSteuern), color: '#e0a526' }]} /></Card>
      <Card><LineChart title="Liquidität kumuliert (36 Monate)" labels={e.labels} series={[{ name: 'Liquidität', data: L.kumuliert, color: '#154c79', area: true }, ...(sum(e.privat.flatMap(x => x.gz)) > 0 ? [{ name: 'ohne Gründungszuschuss', data: L.kumuliertOhneGZ, color: '#c97b2a', dash: true }] : [])]} /></Card>
      <Card><LineChart title="Umsatz je Monat (inkl. Jahr 3)" labels={e.labels} series={[{ name: 'Umsatz netto', data: e.umsatz, color: '#2a7ab0', area: true }, { name: 'Betriebsergebnis', data: e.betriebsergebnis, color: '#e0a526' }]} /></Card>
      <Card><StackBar title={`Private Kosten je Monat (Jahr 1${plan.gruender.length > 1 ? ', alle Personen' : ''})`} items={privat} /></Card>
    </div>

    <Card title="Rentabilitätsvorschau" actions={<div className="seg"><button className={ansicht === 'jahr' ? 'on' : ''} onClick={() => setAnsicht('jahr')}>Jahre</button><button className={ansicht === 'monat' ? 'on' : ''} onClick={() => setAnsicht('monat')}>Monate</button></div>}>
      {periodTable(e, [['Umsatzerlöse', e.umsatz], ['+ Zuschüsse / sonst. Erträge', e.zuschuesse], ['= Betriebsertrag', e.betriebsertrag, 'sum'], ['− Material / Fremdleistung', neg(e.material)], ['− Personal', neg(e.personal)], ['− Abschreibungen', neg(e.afa)], ['− Zinsen', neg(e.zinsen)], ['− Sonstige Kosten', neg(e.kosten)], ['− Einmalige Kosten', neg(e.einmal)], ['= Betriebsergebnis', e.betriebsergebnis, 'sum'], ['± außerordentlich', e.aoErtrag.map((x, i) => x - e.aoAufwand[i])], ['= Ergebnis vor Steuern', e.ergebnisVorSteuern, 'sum']], ansicht)}
    </Card>
    <Card title="Liquiditätsplan (brutto)">
      {periodTable(e, [['Einzahlungen', L.summeEin, 'sum'], ['  Umsatz brutto', L.einz.umsatzBrutto], ['  Darlehen', L.einz.darlehen], ['  Eigenmittel / Zuschüsse', L.einz.bar.map((x, i) => x + L.einz.privatdarlehen[i] + L.einz.sachzuschuss[i] + L.einz.zuschuesse[i] + L.einz.aoErtrag[i] + L.einz.ustErstattung[i])],
        ['Auszahlungen', neg(L.summeAus), 'sum'], ['  Material, Personal, Kosten', neg(L.ausz.material.map((x, i) => x + L.ausz.personal[i] + L.ausz.kosten[i] + L.ausz.einmal[i] + L.ausz.aoAufwand[i]))], ['  Investitionen, Kaution', neg(L.ausz.invest.map((x, i) => x + L.ausz.kaution[i]))], ['  Umsatzsteuer', neg(L.ausz.ust)], ['  Zins und Tilgung', neg(L.ausz.zinsen.map((x, i) => x + L.ausz.tilgung[i]))], ['  Betriebliche Steuern', neg(L.ausz.steuern)], [kapg ? '  Ausschüttungen' : '  Privatentnahmen', neg(kapg ? L.ausz.ausschuettung : L.ausz.privatentnahme)],
        ['Saldo', L.saldo, 'sum'], ['Liquidität kumuliert (Stand)', L.kumuliert, 'sum']], ansicht, new Set(['Liquidität kumuliert (Stand)']))}
    </Card>
    <Help>Alle Werte auf dieser Seite werden berechnet. Ändern Sie Eingaben in den Schritten links – das Dashboard aktualisiert sich sofort. Für die Bank exportieren Sie den Plan als Excel-Datei (Dashboard als erstes Blatt).</Help>
  </div>;
}
export { privatKostenMonat };
