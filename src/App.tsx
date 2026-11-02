import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from './model/types';
import { berechne, privatKostenMonat, jahr } from './calc/plan';
import { laden, speichern, zuruecksetzen } from './io/storage';
import type { ImportErgebnis } from './io/excel';
import { beispielPlan } from './model/beispiel';
import { fmtEUR, StepHinweise, FehlerBox } from './ui/fields';
import { STEPS, fehler, freigeschaltet, bestaetige, bittePruefen, ergebnisStatus, standErgaenzen, stepById } from './model/schritte';
import { SzenarienStep } from './ui/szenarien';
import { APP_VERSION } from './version';
import * as S from './ui/steps';
import { Dashboard } from './ui/dashboard';
import { Tutorial } from './ui/tutorial';

export { STEPS, fehler, freigeschaltet };

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => laden());
  const [aktiv, setAktivRoh] = useState<string>(() => (laden().meta.haftungBestaetigt ? 'projekt' : 'start'));
  const setAktiv = (id: string) => setAktivRoh(id);
  const [tutorial, setTutorial] = useState<boolean>(() => !laden().meta.tutorialGesehen);
  const [importDlg, setImportDlg] = useState<ImportErgebnis | null>(null);
  const [toast, setToast] = useState<string>('');
  const [fehlerAnz, setFehlerAnz] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetDlg, setResetDlg] = useState(false);
  const [resetGesichert, setResetGesichert] = useState('');
  const nachReset = useRef(false);
  const e = useMemo(() => berechne(plan), [plan]);
  const pruefen = useMemo(() => bittePruefen(plan), [plan]);
  const status = useMemo(() => ergebnisStatus(plan, pruefen), [plan, pruefen]);

  // nach einem Reset nichts speichern, bis wieder etwas eingegeben wird (localStorage bleibt leer)
  useEffect(() => { if (nachReset.current) { nachReset.current = false; return; } speichern(plan); }, [plan]);
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
    upd(p => { p.meta.erledigt[step.id] = true; bestaetige(step.id, p); if (step.id === 'start') p.meta.tutorialGesehen = true; });
    const idx = sichtbar.findIndex(s => s.id === step.id);
    const naechster = sichtbar.slice(idx + 1).find(s => s.art !== 'optional') ?? sichtbar[idx + 1];
    if (naechster) setAktiv(naechster.id);
    setToast(pruefen[step.id] ? `Schritt „${step.titel}“ geprüft und bestätigt.` : `Schritt „${step.titel}“ abgeschlossen.`);
  };
  const ergebnisBestaetigen = () => upd(p => { p.meta.bestaetigtAm = new Date().toISOString(); bestaetige('ergebnis', p); });

  const pdfErstellen = async () => {
    try {
      setToast('PDF wird erstellt …');
      const { erstellePdf } = await import('./io/pdf');
      const { blob, dateiname } = await erstellePdf(plan);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = dateiname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast(`PDF „${dateiname}“ erstellt.`);
    } catch (err) { setToast('PDF-Erstellung fehlgeschlagen: ' + (err as Error).message); }
  };

  const allesZuruecksetzen = () => {
    nachReset.current = true;
    setPlan(zuruecksetzen());
    setImportDlg(null); setFehlerAnz([]); setResetDlg(false); setResetGesichert('');
    if (fileRef.current) fileRef.current.value = '';
    setAktiv('start'); setTutorial(true);
    setToast('Alle Eingaben wurden gelöscht – der Plan beginnt von vorn.');
  };
  const exportieren = async (): Promise<string | null> => {
    try {
      const { exportiere } = await import('./io/excel');
      const { blob, dateiname } = await exportiere(plan);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = dateiname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast(`Excel-Datei „${dateiname}“ erstellt.`);
      return dateiname;
    } catch (err) { setToast('Export fehlgeschlagen: ' + (err as Error).message); return null; }
  };
  const importieren = async (file: File) => {
    try { const { importiere } = await import('./io/excel'); const r = await importiere(await file.arrayBuffer()); setImportDlg(r); }
    catch (err) { setToast((err as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const props = { plan, e, upd };
  const inhalt = (() => {
    switch (step.id) {
      case 'start': return <S.StartStep {...props} onTutorial={() => setTutorial(true)} onBeispiel={() => { if (confirm('Beispielprojekt laden? Ihre aktuellen Eingaben werden ersetzt (vorher ggf. exportieren).')) { const b = beispielPlan(); b.meta.tutorialGesehen = true; b.meta.haftungBestaetigt = true; standErgaenzen(b); setPlan(b); setFehlerAnz([]); setToast('Beispielprojekt „Muster Werkstatt“ geladen.'); } }} />;
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
      case 'ergebnis': return <Dashboard plan={plan} e={e} gotoStep={setAktiv} status={status} pruefen={pruefen} onBestaetigen={ergebnisBestaetigen} onPdf={pdfErstellen} />;
      case 'szenarien': return <SzenarienStep plan={plan} e={e} />;
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
      <div className="brand"><span className="wordmark" aria-label="ThEx Finanzplan"><b>ThEx</b> Finanzplan</span><small>Gründungs- und Finanzplanung · Mikrodarlehen Thüringen</small></div>
      <div className="proj">{plan.projekt.name || 'Neuer Plan'} <span className="muted">· {S.RECHTSFORMEN.find(r => r[0] === plan.einstellungen.rechtsform)?.[1]}</span></div>
      <div className="tools">
        <button className="btn ghost" onClick={() => setTutorial(true)}>Einführung</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Excel importieren</button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden data-testid="import-input" onChange={ev => ev.target.files?.[0] && importieren(ev.target.files[0])} />
        <button className="btn primary" onClick={exportieren}>Excel exportieren</button>
        <button className="btn ghost" onClick={pdfErstellen} disabled={!offen('ergebnis')} title={offen('ergebnis') ? 'Zusammenfassung als PDF für die Thüringer Aufbaubank' : 'Verfügbar, sobald alle Pflichtschritte abgeschlossen sind'}>PDF für TAB</button>
        <details className="menu"><summary className="btn ghost">⋯</summary><div>
          <button onClick={() => window.print()}>Bildschirmansicht drucken</button>
          <label className="check"><input type="checkbox" checked={plan.meta.pruefer} onChange={ev => upd(p => (p.meta.pruefer = ev.target.checked))} /> Prüfer-Ansicht</label>
          <button className="danger" onClick={ev => { (ev.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); setResetDlg(true); }}>Alles zurücksetzen …</button>
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
          const pr = auf && !!pruefen[s.id];
          const err = auf && e.warnungen.some(w => w.fehler && w.schritt === s.id);
          const icon = !auf ? '🔒' : err ? '✕' : pr ? '↻' : done ? '✓' : warn ? '!' : s.nr;
          return <li key={s.id} data-testid={`nav-${s.id}`} className={`${s.id === step.id ? 'active' : ''} ${auf ? '' : 'locked'} ${done ? 'done' : ''} ${warn ? 'warn' : ''} ${pr ? 'pruefen' : ''} ${err ? 'fehler' : ''} ${s.art}`}>
            <button onClick={() => setAktiv(s.id)} title={!auf ? 'Wird freigeschaltet, sobald die vorherigen Schritte abgeschlossen sind.' : pr ? `Bitte prüfen: ${pruefen[s.id].map(x => stepById(x)?.titel).join(', ')} wurde geändert.` : ''}><span className="ico">{icon}</span><span className="t">{s.titel}{s.art === 'optional' && <em> optional</em>}{err ? <em className="fe"> Fehler</em> : pr && <em className="pr"> bitte prüfen</em>}</span></button>
          </li>;
        })}</ol>
        <div className="side-kd">
          <small>KD-Ampel</small>
          <div className={`pill ${offen('ergebnis') ? e.kd.ampel : 'aus'} ${offen('ergebnis') && status.status !== 'bestaetigt' ? (status.status === 'veraltet' ? 'veraltet' : 'offen-st') : ''}`} data-testid="side-kd">{offen('ergebnis') ? (isFinite(e.kd.auslastung) ? `${(e.kd.auslastung * 100).toFixed(1).replace('.', ',')} %` : 'nicht gegeben') : '–'}</div>
          {offen('ergebnis') && <small className={`kd-status ${status.status}`} data-testid="side-kd-status">{status.status === 'bestaetigt' ? '✓ bestätigt' : status.status === 'veraltet' ? '↻ nicht aktuell bestätigt' : 'noch nicht bestätigt'}</small>}
          {status.fehler.length > 0 ? <small className="kd-status fehler" data-testid="side-liq-fehler">✕ Liquidität negativ ({fmtEUR(e.liq.tiefpunkt)}) – nicht einreichungsfähig</small> : <small className="muted">Liquidität min. {fmtEUR(e.liq.tiefpunkt)}</small>}
        </div>
        <div className="side-reset"><button className="btn link danger small" data-testid="reset-oeffnen" onClick={() => setResetDlg(true)} title="Alle Eingaben löschen und mit einem leeren Plan neu beginnen">⟲ Alles zurücksetzen …</button></div>
      </nav>
      <main className="content">
        <>
        <div className="step-head"><span className="nr">Schritt {step.nr}</span><h2>{step.titel}</h2>{plan.meta.erledigt[step.id] && !pruefen[step.id] && <span className="badge ok">abgeschlossen</span>}{pruefen[step.id] && <span className="badge pruefen">bitte prüfen</span>}</div>
        {gesperrt ? <div className="locked-box"><div className="big">🔒</div><p>Dieser Schritt wird freigeschaltet, sobald Sie die vorherigen Schritte abgeschlossen haben:</p>
          <ul>{STEPS.filter(s => s.art === 'pflicht' && !plan.meta.erledigt[s.id]).slice(0, 3).map(s => <li key={s.id}><button className="btn link" onClick={() => setAktiv(s.id)}>{s.nr} {s.titel}</button></li>)}</ul></div>
          : <>
            {pruefen[step.id] && <div className="pruefen-box" role="status" data-testid="pruefen-box"><b>↻ Bitte prüfen:</b> Seit Sie diesen Schritt {step.id === 'ergebnis' ? 'bestätigt' : 'abgeschlossen'} haben, wurden frühere Angaben geändert: {pruefen[step.id].map((x, i) => <React.Fragment key={x}>{i > 0 && ', '}<button className="btn link" onClick={() => setAktiv(x)}>{stepById(x)?.nr} {stepById(x)?.titel}</button></React.Fragment>)}. Bitte kontrollieren Sie Ihre Angaben hier und bestätigen Sie {step.id === 'ergebnis' ? 'das Ergebnis erneut' : <>mit „Prüfen und weiter“</>}.</div>}
            {step.id !== 'ergebnis' && <FehlerBox warnungen={e.warnungen} schritt={step.id} onGoto={setAktiv} />}
            {step.id !== 'ergebnis' && <StepHinweise warnungen={e.warnungen} schritt={step.id} />}
            {inhalt}
            {fehlerAnz.length > 0 && <div className="errors" role="alert"><b>Bitte noch ergänzen bzw. korrigieren:</b><ul>{fehlerAnz.map(f => <li key={f}>{f}</li>)}</ul></div>}
            <div className="step-foot">
              {step.art !== 'ergebnis' && <button className="btn primary" onClick={abschliessen}>{step.art === 'optional' ? 'Fertig' : plan.meta.erledigt[step.id] ? 'Prüfen und weiter' : 'Schritt abschließen'} →</button>}
              {step.art === 'ergebnis' && <><button className="btn primary" onClick={exportieren}>Plan als Excel exportieren</button> <button className="btn ghost" onClick={pdfErstellen}>PDF für TAB</button></>}
            </div></>}
        </>
        <footer className="footer"><span>ThEx Finanzplan {APP_VERSION} · Rechenhilfe, keine Kreditentscheidung · Daten bleiben in Ihrem Browser</span></footer>
      </main>
    </div>
    {resetDlg && <div className="modal-bg" onKeyDown={ev => ev.key === 'Escape' && setResetDlg(false)}><div className="modal reset" role="alertdialog" aria-modal="true" aria-labelledby="reset-titel" aria-describedby="reset-text" data-testid="reset-dialog">
      <h3 id="reset-titel">Alles zurücksetzen?</h3>
      <div id="reset-text">
        <p><b>Alle Eingaben werden unwiderruflich gelöscht</b>{plan.projekt.name ? <> – auch der Plan „{plan.projekt.name}“</> : null}:</p>
        <ul><li>alle Felder (Projekt, private Kosten, Umsatz, Personal, Investitionen, Kosten, Darlehen, Liquidität, Steuer-Parameter, Stundensatz)</li>
          <li>abgeschlossene Schritte, „bitte prüfen“-Markierungen und die Bestätigung des Ergebnisses</li>
          <li>die im Browser gespeicherten Daten dieses Plans</li></ul>
        <p>Danach beginnen Sie wieder bei Schritt 0 mit einem leeren Plan; die Einführung wird erneut angezeigt. Wenn Sie Ihre Daten behalten möchten, sichern Sie den Plan vorher als Excel-Datei – diese können Sie später wieder importieren.</p>
      </div>
      {resetGesichert && <p className="pos" data-testid="reset-gesichert">✓ Gesichert als „{resetGesichert}“.</p>}
      <div className="modal-foot reset-foot">
        <button className="btn ghost" onClick={async () => { const n = await exportieren(); if (n) setResetGesichert(n); }}>Vorher als Excel sichern</button>
        <span className="grow" />
        <button className="btn ghost" autoFocus onClick={() => { setResetDlg(false); setResetGesichert(''); }}>Abbrechen</button>
        <button className="btn danger-solid" onClick={allesZuruecksetzen}>Ja, alles löschen</button>
      </div>
    </div></div>}
    {tutorial && <Tutorial onClose={() => { setTutorial(false); upd(p => (p.meta.tutorialGesehen = true)); }} />}
    {importDlg && <div className="modal-bg"><div className="modal wide" role="dialog" aria-label="Import bestätigen">
      <h3>Excel-Datei importieren</h3>
      <p className="muted">Exportiert am {new Date(importDlg.meta.exportiert).toLocaleString('de-DE')} · Version {importDlg.meta.appVersion} · {importDlg.meta.hashOk ? 'Datenblock unverändert' : <b className="neg">Datenblock wurde verändert</b>}</p>
      {importDlg.aenderungen.length === 0 ? <p>In den Eingabezellen wurden <b>keine Änderungen</b> gegenüber dem exportierten Stand gefunden. Der Plan aus der Datei wird vollständig übernommen und ersetzt den aktuellen Stand im Browser.</p>
        : <><p><b>{importDlg.aenderungen.length} Änderung(en)</b> in der Excel-Datei gefunden. Bitte prüfen und bestätigen:</p>
          <div className="scroll tall"><table className="tbl result"><thead><tr><th>Feld</th><th>bisher</th><th>neu</th></tr></thead><tbody>
            {importDlg.aenderungen.map(a => <tr key={a.path}><td>{a.label}</td><td>{String(a.alt ?? '')}</td><td><b>{String(a.neu)}</b></td></tr>)}</tbody></table></div></>}
      <div className="row gap end"><button className="btn ghost" onClick={() => setImportDlg(null)}>Abbrechen</button><button className="btn primary" onClick={() => { const n = importDlg.plan; const anz = Object.keys(bittePruefen(n)).length; setPlan(n); setImportDlg(null); setToast(anz ? `Import übernommen – ${anz} Schritt(e) bitte prüfen.` : 'Import übernommen.'); }}>Übernehmen</button></div>
    </div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
