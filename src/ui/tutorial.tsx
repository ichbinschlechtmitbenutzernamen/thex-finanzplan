import React, { useState } from 'react';

const FOLIEN: { titel: string; text: React.ReactNode; icon: string }[] = [
  { icon: '🎯', titel: 'Willkommen beim ThEx-Finanzplan', text: <>Mit diesem Werkzeug erstellen Sie Schritt für Schritt den Finanzplan für Ihre Gründung – als Grundlage für den Antrag auf das <b>Mikrodarlehen der Thüringer Aufbaubank</b> und für die Begleitung durch ThEx. Am Ende stehen Rentabilitätsvorschau, Liquiditätsplan und die Prüfung der <b>Kapitaldienstfähigkeit</b>.</> },
  { icon: '€', titel: 'Netto, brutto und Umsatzsteuer', text: <>Umsätze und Kosten planen Sie <b>netto</b>. Die Umsatzsteuer berechnet der Plan selbst und zeigt in der Liquidität, wann sie gezahlt oder erstattet wird. Als <b>Kleinunternehmer</b> (§ 19 UStG) planen Sie alle Kosten brutto – die Einstellung treffen Sie im ersten Schritt.</> },
  { icon: '🔓', titel: 'Schritt für Schritt', text: <>Die Schritte links bauen aufeinander auf. Ein Schritt wird freigeschaltet, sobald Sie den vorherigen mit <b>„Schritt abschließen“</b> beendet haben. Frühere Angaben können Sie jederzeit ändern – alle Ergebnisse rechnen sich sofort neu. Das <b>?</b> neben einem Feld erklärt die Eingabe.</> },
  { icon: '💾', titel: 'Ihre Daten', text: <>Ihre Eingaben werden <b>nur in diesem Browser</b> gespeichert, nicht auf einem Server. Mit <b>„Excel exportieren“</b> sichern Sie den Plan als Excel-Datei (für die Bank, ThEx oder sich selbst). Diese Datei können Sie später mit <b>„Excel importieren“</b> wieder laden – auch nachdem Sie die gelben Eingabezellen in Excel geändert haben.</> },
  { icon: '⚖️', titel: 'Was ist Kapitaldienstfähigkeit?', text: <>Die Bank prüft, ob Ihr Unternehmen im <b>zweiten Planjahr</b> genug erwirtschaftet, um nach Ihrer Lebenshaltung, Kranken- und Rentenversicherung und Steuern auch <b>Zins und Tilgung</b> des Darlehens zu zahlen. Der Kapitaldienst darf höchstens <b>95 %</b> der verbleibenden Mittel ausmachen. Die Ampel im Ergebnis zeigt, ob das gelingt – und welcher Darlehensbetrag höchstens tragbar ist.</> },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const f = FOLIEN[i];
  return <div className="modal-bg"><div className="modal tutorial" role="dialog" aria-label="Einführung">
    <div className="tut-icon">{f.icon}</div>
    <h3>{f.titel}</h3>
    <p>{f.text}</p>
    <div className="dots">{FOLIEN.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Folie ${k + 1}`} />)}</div>
    <div className="row gap between">
      <button className="btn link" onClick={onClose}>Überspringen</button>
      <span className="row gap">{i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Zurück</button>}
        {i < FOLIEN.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Weiter</button> : <button className="btn primary" onClick={onClose}>Los geht's</button>}</span>
    </div>
  </div></div>;
}
