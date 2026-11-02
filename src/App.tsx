import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from './model/types';
import { berechne, privatKostenMonat, jahr } from './calc/plan';
import { laden, speichern } from './io/storage';
import type { ImportErgebnis } from './io/excel';
import { leererPlan } from './model/defaults';
import { beispielPlan } from './model/beispiel';
import { fmtEUR } from './ui/fields';
import * as S from './ui/steps';
import { Dashboard } from './ui/dashboard';
import { Tutorial } from './ui/tutorial';

interface StepDef { id: string; nr: string; titel: string; nach: string[]; art: 'pflicht' | 'optional' | 'ergebnis'; sichtbar?: (p: Plan) => boolean; abschliessbar?: boolean }
export const STEPS: StepDef[] = [
  { id: 'start', nr: '0', titel: 'Start & Einstellungen', nach: [], art: 'pflicht' },
  { id: 'projekt', nr: '1', titel: 'Projektdaten', nach: ['start'], art: 'pflicht' },
  { id: 'privat', nr: '2', titel: 'Private Kosten', nach: ['projekt'], art: 'pflicht' },
  { id: 'haushaltsbuch', nr: '2a', titel: 'Haushaltsbuch', nach: ['projekt'], art: 'optional' },
  { id: 'umsatz', nr: '3', titel: 'Umsatzplanung', nach: ['privat'], art: 'pflicht' },
  { id: 'personal', nr: '4', titel: 'Personal', nach: ['umsatz'], art: 'pflicht' },
  { id: 'invest', nr: '5', titel: 'Kapitalbedarf', nach: ['personal'], art: 'pflicht' },
  { id: 'kosten', nr: '6', titel: 'Betriebliche Kosten', nach: ['invest'], art: 'pflicht' },
  { id: 'darlehen', nr: '7', titel: 'Finanzierung & Darlehen', nach: ['kosten'], art: 'pflicht' },
  { id: 'liquiditaet', nr: '8', titel: 'Liquidität & Eigenmittel', nach: ['darlehen'], art: 'pflicht' },
  { id: 'steuern', nr: '9', titel: 'Steuern & Abgaben', nach: ['liquiditaet'], art: 'pflicht' },
  { id: 'ergebnis', nr: '10', titel: 'Ergebnis & KD-Prüfung', nach: ['steuern'], art: 'ergebnis' },
  { id: 'stundensatz', nr: '11', titel: 'Stundensatz', nach: ['privat'], art: 'optional' },
  { id: 'sollist', nr: '12', titel: 'Soll-Ist', nach: ['steuern'], art: 'optional', sichtbar: p => p.einstellungen.folgedarlehen },
  { id: 'pruefung', nr: 'P', titel: 'Prüfung (Kontoauszüge)', nach: ['privat'], art: 'optional', sichtbar: p => p.meta.pruefer },
];

/** Pflichtprüfung je Schritt: Fehler blockieren das Abschließen */
export function fehler(id: string, p: Plan): string[] {
  const f: string[] = [];
  const rf = p.einstellungen.rechtsform;
  switch (id) {
    case 'start': if (!p.meta.haftungBestaetigt) f.push('Bitte bestätigen Sie die Hinweise.'); break;
    case 'projekt':
      if (!p.projekt.name.trim()) f.push('Projekt- bzw. Firmenname fehlt.');
      if (!/^\d{4}-\d{2}$/.test(p.projekt.gruendungsmonat)) f.push('Gründungsmonat fehlt.');
      if (p.gruender.some(g => !g.name.trim())) f.push('Bitte alle Namen eintragen.');
      if (rf === 'GBR' && p.gruender.length < 2) f.push('Eine GbR braucht mindestens zwei Gesellschafter/innen.');
      if (rf === 'GBR' && Math.abs(p.gruender.reduce((s, g) => s + g.anteil, 0) - 100) > 0.01) f.push('Gewinnanteile müssen zusammen 100 % ergeben.');
      break;
    case 'privat': p.gruender.forEach(g => { if (!(privatKostenMonat(g, 0) > 0)) f.push(`${g.name}: private Kosten für Jahr 1 fehlen.`); if (g.kv === 'privat' && !(g.kvPrivatMonat > 0)) f.push(`${g.name}: PKV-Beitrag fehlt.`); }); break;
    case 'umsatz': if (!(jahr(berechne(p).umsatz, 1) > 0)) f.push('Bitte planen Sie Umsätze für Jahr 1.'); if (p.umsatz.felder.some(x => x.materialQuote < 0 || x.materialQuote > 1)) f.push('Materialquote muss zwischen 0 und 100 % liegen.'); break;
    case 'personal': p.personal.forEach(s => { if (s.von > s.bis) f.push(`${s.bez || 'Stelle'}: „von“ liegt nach „bis“.`); }); break;
    case 'invest': p.invest.forEach(x => { if (x.netto > 0 && !x.gwg && !(x.ndJahre > 0)) f.push(`${x.bez || 'Investition'}: Nutzungsdauer fehlt.`); }); break;
    case 'darlehen': {
      const d = p.darlehen[0];
      const max = p.einstellungen.folgedarlehen ? 45000 : 35000;
      if (!(d.betrag >= 5000 && d.betrag <= max)) f.push(`Mikrodarlehen: Betrag zwischen 5.000 € und ${max.toLocaleString('de-DE')} € eintragen.`);
      if (d.laufzeit > 84) f.push('Mikrodarlehen: Laufzeit höchstens 84 Monate.');
      if (d.tilgungsfrei > 12) f.push('Mikrodarlehen: höchstens 12 tilgungsfreie Monate.');
      p.darlehen.forEach((x, i) => { if (x.betrag > 0 && x.laufzeit <= x.tilgungsfrei) f.push(`Darlehen ${i + 1}: Laufzeit muss größer als die tilgungsfreie Zeit sein.`); });
      break;
    }
  }
  return f;
}

export function freigeschaltet(id: string, p: Plan, seen = new Set<string>()): boolean {
  const s = STEPS.find(x => x.id === id)!;
  if (seen.has(id)) return false; seen.add(id);
  return s.nach.every(n => p.meta.erledigt[n] && freigeschaltet(n, p, seen));
}

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => laden());
  const [aktiv, setAktiv] = useState<string>(() => (laden().meta.haftungBestaetigt ? 'projekt' : 'start'));
  const [tutorial, setTutorial] = useState<boolean>(() => !laden().meta.tutorialGesehen);
  const [importDlg, setImportDlg] = useState<ImportErgebnis | null>(null);
  const [toast, setToast] = useState<string>('');
  const [fehlerAnz, setFehlerAnz] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const e = useMemo(() => berechne(plan), [plan]);

  useEffect(() => { speichern(plan); }, [plan]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { setFehlerAnz([]); window.scrollTo?.(0, 0); }, [aktiv]);

  const upd: S.Upd = fn => setPlan(prev => { const n = structuredClone(prev); fn(n); n.meta.geaendert = new Date().toISOString(); return n; });
  const sichtbar = STEPS.filter(s => !s.sichtbar || s.sichtbar(plan));
  const step = sichtbar.find(s => s.id === aktiv) ?? sichtbar[0];
  const offen = (id: string) => freigeschaltet(id, plan);

  const abschliessen = () => {
    const f = fehler(step.id, plan);
    if (f.length) { setFehlerAnz(f); return; }
    setFehlerAnz([]);
    upd(p => { p.meta.erledigt[step.id] = true; if (step.id === 'start') p.meta.tutorialGesehen = true; });
    const idx = sichtbar.findIndex(s => s.id === step.id);
    const naechster = sichtbar.slice(idx + 1).find(s => s.art !== 'optional') ?? sichtbar[idx + 1];
    if (naechster) setAktiv(naechster.id);
    setToast(`Schritt „${step.titel}“ abgeschlossen.`);
  };

  const exportieren = async () => {
    try {
      const { exportiere } = await import('./io/excel');
      const { blob, dateiname } = await exportiere(plan);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = dateiname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast(`Excel-Datei „${dateiname}“ erstellt.`);
    } catch (err) { setToast('Export fehlgeschlagen: ' + (err as Error).message); }
  };
  const importieren = async (file: File) => {
    try { const { importiere } = await import('./io/excel'); const r = await importiere(await file.arrayBuffer()); setImportDlg(r); }
    catch (err) { setToast((err as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const props = { plan, e, upd };
  const inhalt = (() => {
    switch (step.id) {
      case 'start': return <S.StartStep {...props} onTutorial={() => setTutorial(true)} onBeispiel={() => { if (confirm('Beispielprojekt laden? Ihre aktuellen Eingaben werden ersetzt (vorher ggf. exportieren).')) { const b = beispielPlan(); b.meta.tutorialGesehen = true; b.meta.haftungBestaetigt = true; setPlan(b); setFehlerAnz([]); setToast('Beispielprojekt „Muster Werkstatt“ geladen.'); } }} />;
      case 'projekt': return <S.ProjektStep {...props} />;
      case 'privat': return <S.PrivatStep {...props} />;
      case 'haushaltsbuch': return <S.HaushaltsbuchStep {...props} />;
      case 'umsatz': return <S.UmsatzStep {...props} />;
      case 'personal': return <S.PersonalStep {...props} />;
      case 'invest': return <S.InvestStep {...props} />;
      case 'kosten': return <S.KostenStep {...props} />;
      case 'darlehen': return <S.DarlehenStep {...props} />;
      case 'liquiditaet': return <S.LiquiditaetStep {...props} />;
      case 'steuern': return <S.SteuernStep {...props} />;
      case 'ergebnis': return <Dashboard plan={plan} e={e} gotoStep={setAktiv} />;
      case 'stundensatz': return <S.StundensatzStep {...props} />;
      case 'sollist': return <S.SollIstStep {...props} />;
      case 'pruefung': return <S.PruefungStep {...props} />;
    }
  })();
  const gesperrt = !offen(step.id);
  const pflicht = STEPS.filter(s => s.art === 'pflicht');
  const fortschritt = pflicht.filter(s => plan.meta.erledigt[s.id]).length / pflicht.length;

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="logo">ThEx</span><div><b>Finanzplan</b><small>Gründungs- und Finanzplanung · Mikrodarlehen Thüringen</small></div></div>
      <div className="proj">{plan.projekt.name || 'Neuer Plan'} <span className="muted">· {S.RECHTSFORMEN.find(r => r[0] === plan.einstellungen.rechtsform)?.[1]}</span></div>
      <div className="tools">
        <button className="btn ghost" onClick={() => setTutorial(true)}>Einführung</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Excel importieren</button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden data-testid="import-input" onChange={ev => ev.target.files?.[0] && importieren(ev.target.files[0])} />
        <button className="btn primary" onClick={exportieren}>Excel exportieren</button>
        <details className="menu"><summary className="btn ghost">⋯</summary><div>
          <button onClick={() => window.print()}>Drucken / PDF</button>
          <label className="check"><input type="checkbox" checked={plan.meta.pruefer} onChange={ev => upd(p => (p.meta.pruefer = ev.target.checked))} /> Prüfer-Ansicht</label>
          <button className="danger" onClick={() => { if (confirm('Alle Eingaben löschen und neu beginnen?')) { setPlan(leererPlan()); setAktiv('start'); setTutorial(true); } }}>Neuen Plan beginnen</button>
        </div></details>
      </div>
    </header>
    <div className="layout">
      <nav className="sidebar" aria-label="Schritte">
        <div className="progress"><div style={{ width: `${fortschritt * 100}%` }} /></div>
        <small className="muted">{Math.round(fortschritt * 100)} % der Pflichtschritte erledigt</small>
        <ol>{sichtbar.map(s => {
          const auf = offen(s.id), done = !!plan.meta.erledigt[s.id];
          const warn = auf && (e.warnungen.some(w => w.schritt === s.id) || (done && fehler(s.id, plan).length > 0));
          const icon = !auf ? '🔒' : done ? '✓' : warn ? '!' : s.nr;
          return <li key={s.id} className={`${s.id === step.id ? 'active' : ''} ${auf ? '' : 'locked'} ${done ? 'done' : ''} ${warn ? 'warn' : ''} ${s.art}`}>
            <button onClick={() => setAktiv(s.id)} title={auf ? '' : 'Wird freigeschaltet, sobald die vorherigen Schritte abgeschlossen sind.'}><span className="ico">{icon}</span><span className="t">{s.titel}{s.art === 'optional' && <em> optional</em>}</span></button>
          </li>;
        })}</ol>
        <div className="side-kd">
          <small>KD-Ampel</small>
          <div className={`pill ${offen('ergebnis') ? e.kd.ampel : 'aus'}`}>{offen('ergebnis') ? (isFinite(e.kd.auslastung) ? `${(e.kd.auslastung * 100).toFixed(1).replace('.', ',')} %` : 'nicht gegeben') : '–'}</div>
          <small className="muted">Liquidität min. {fmtEUR(e.liq.tiefpunkt)}</small>
        </div>
      </nav>
      <main className="content">
        <div className="step-head"><span className="nr">Schritt {step.nr}</span><h2>{step.titel}</h2>{plan.meta.erledigt[step.id] && <span className="badge ok">abgeschlossen</span>}</div>
        {gesperrt ? <div className="locked-box"><div className="big">🔒</div><p>Dieser Schritt wird freigeschaltet, sobald Sie die vorherigen Schritte abgeschlossen haben:</p>
          <ul>{STEPS.filter(s => s.art === 'pflicht' && !plan.meta.erledigt[s.id]).slice(0, 3).map(s => <li key={s.id}><button className="btn link" onClick={() => setAktiv(s.id)}>{s.nr} {s.titel}</button></li>)}</ul></div>
          : <>{inhalt}
            {fehlerAnz.length > 0 && <div className="errors" role="alert"><b>Bitte noch ergänzen:</b><ul>{fehlerAnz.map(f => <li key={f}>{f}</li>)}</ul></div>}
            <div className="step-foot">
              {step.art !== 'ergebnis' && <button className="btn primary" onClick={abschliessen}>{step.art === 'optional' ? 'Fertig' : plan.meta.erledigt[step.id] ? 'Prüfen und weiter' : 'Schritt abschließen'} →</button>}
              {step.art === 'ergebnis' && <button className="btn primary" onClick={exportieren}>Plan als Excel exportieren</button>}
            </div></>}
      </main>
    </div>
    {tutorial && <Tutorial onClose={() => { setTutorial(false); upd(p => (p.meta.tutorialGesehen = true)); }} />}
    {importDlg && <div className="modal-bg"><div className="modal wide" role="dialog" aria-label="Import bestätigen">
      <h3>Excel-Datei importieren</h3>
      <p className="muted">Exportiert am {new Date(importDlg.meta.exportiert).toLocaleString('de-DE')} · Version {importDlg.meta.appVersion} · {importDlg.meta.hashOk ? 'Datenblock unverändert' : <b className="neg">Datenblock wurde verändert</b>}</p>
      {importDlg.aenderungen.length === 0 ? <p>In den Eingabezellen wurden <b>keine Änderungen</b> gegenüber dem exportierten Stand gefunden. Der Plan aus der Datei wird vollständig übernommen und ersetzt den aktuellen Stand im Browser.</p>
        : <><p><b>{importDlg.aenderungen.length} Änderung(en)</b> in der Excel-Datei gefunden. Bitte prüfen und bestätigen:</p>
          <div className="scroll tall"><table className="tbl result"><thead><tr><th>Feld</th><th>bisher</th><th>neu</th></tr></thead><tbody>
            {importDlg.aenderungen.map(a => <tr key={a.path}><td>{a.label}</td><td>{String(a.alt ?? '')}</td><td><b>{String(a.neu)}</b></td></tr>)}</tbody></table></div></>}
      <div className="row gap end"><button className="btn ghost" onClick={() => setImportDlg(null)}>Abbrechen</button><button className="btn primary" onClick={() => { setPlan(importDlg.plan); setImportDlg(null); setToast('Import übernommen.'); }}>Übernehmen</button></div>
    </div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
