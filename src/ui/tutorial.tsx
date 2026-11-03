import React, { useEffect, useState } from 'react';
import type { Plan } from '../model/types';
import { mdAktiv, gzAktiv, nurSchaetzung } from '../model/zweck';
import { ZweckAuswahl } from './zweck';

type Folie = { titel: string; text: React.ReactNode; icon: string; zweck?: boolean };

/** Folien der Einführung – passen sich an den gewählten Planzweck an */
export function folien(plan: Plan): Folie[] {
  const f: Folie[] = [
    { icon: '🎯', titel: 'Willkommen beim ThEx-Finanzplan', zweck: true, text: <>Mit diesem Werkzeug erstellen Sie Schritt für Schritt den Finanzplan für Ihre Gründung – mit Kapitalbedarf, Rentabilitätsvorschau und Liquiditätsplan für 3 Jahre. <b>Wofür erstellen Sie den Finanzplan?</b> Mehrfachauswahl ist möglich; Sie können den Zweck später in der Seitenleiste ändern.</> },
    { icon: '€', titel: 'Netto, brutto und Umsatzsteuer', text: <>Umsätze und Kosten planen Sie <b>netto</b>. Die Umsatzsteuer berechnet der Plan selbst und zeigt in der Liquidität, wann sie gezahlt oder erstattet wird. Als <b>Kleinunternehmer</b> (§ 19 UStG) planen Sie alle Kosten brutto – die Einstellung treffen Sie im ersten Schritt.</> },
    { icon: '🔓', titel: 'Schritt für Schritt', text: <>Die Schritte links bauen aufeinander auf. Ein Schritt wird freigeschaltet, sobald Sie den vorherigen mit <b>„Schritt abschließen“</b> beendet haben. Frühere Angaben können Sie jederzeit ändern – alle Ergebnisse rechnen sich sofort neu. Das <b>?</b> neben einem Feld erklärt die Eingabe.</> },
    { icon: '💾', titel: 'Ihre Daten', text: <>Ihre Eingaben werden <b>nur in diesem Browser</b> gespeichert, nicht auf einem Server. Mit <b>„Excel exportieren“</b> sichern Sie den Plan als Excel-Datei (für die Bank, die Beratung oder sich selbst). Diese Datei können Sie später mit <b>„Excel importieren“</b> wieder laden – auch nachdem Sie die gelben Eingabezellen in Excel geändert haben.</> },
  ];
  if (nurSchaetzung(plan)) f.push({ icon: '🧭', titel: 'Erste Schätzung', text: <>Für eine erste Schätzung sind weniger Angaben Pflicht: fehlende Namen oder private Kosten und eine negative Liquidität werden als <b>Hinweis</b> angezeigt, nicht als Sperre. Wenn daraus ein Antrag wird, wählen Sie einfach zusätzlich <b>Gründungszuschuss</b> oder <b>Mikrodarlehen</b> – Ihre Eingaben bleiben erhalten.</> });
  if (gzAktiv(plan)) f.push({ icon: '📄', titel: 'Gründungszuschuss', text: <>Für den Gründungszuschuss der Agentur für Arbeit bestätigt eine <b>fachkundige Stelle</b> (z. B. Kammer, Gründungsberatung) die Tragfähigkeit. Dafür brauchen Sie <b>Kapitalbedarfsplan, Rentabilitätsvorschau und Liquiditätsplan für 3 Jahre</b> – der Plan erstellt sie, das PDF fasst sie zusammen. Den erwarteten Zuschuss tragen Sie in Schritt 2 als private Einnahme ein.</> });
  if (mdAktiv(plan)) f.push({ icon: '⚖️', titel: 'Was ist Kapitaldienstfähigkeit?', text: <>Für das <b>Mikrodarlehen der Thüringer Aufbaubank</b> prüft die Bank, ob Ihr Unternehmen im <b>zweiten Planjahr</b> genug erwirtschaftet, um nach Ihrer Lebenshaltung, Kranken- und Rentenversicherung und Steuern auch <b>Zins und Tilgung</b> des Darlehens zu zahlen. Der Kapitaldienst darf höchstens <b>95 %</b> der verbleibenden Mittel ausmachen. Die Ampel im Ergebnis zeigt, ob das gelingt – und welcher Darlehensbetrag höchstens tragbar ist.</> });
  return f;
}

export function Tutorial({ plan, upd, onClose }: { plan: Plan; upd: (fn: (p: Plan) => void) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  const liste = folien(plan);
  const k = Math.min(i, liste.length - 1);
  const f = liste[k];
  useEffect(() => { const h = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <div className="modal-bg"><div className="modal tutorial" role="dialog" aria-label="Einführung">
    <div className="tut-icon">{f.icon}</div>
    <h3>{f.titel}</h3>
    <p>{f.text}</p>
    {f.zweck && <ZweckAuswahl plan={plan} upd={upd} />}
    <div className="dots">{liste.map((_, n) => <button key={n} className={n === k ? 'on' : ''} onClick={() => setI(n)} aria-label={`Folie ${n + 1}`} />)}</div>
    <div className="row gap between">
      <button className="btn link" onClick={onClose}>Überspringen</button>
      <span className="row gap">{k > 0 && <button className="btn ghost" onClick={() => setI(k - 1)}>Zurück</button>}
        {k < liste.length - 1 ? <button className="btn primary" onClick={() => setI(k + 1)}>Weiter</button> : <button className="btn primary" onClick={onClose}>Los geht's</button>}</span>
    </div>
  </div></div>;
}
