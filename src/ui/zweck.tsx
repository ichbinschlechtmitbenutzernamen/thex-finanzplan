import React, { useState } from 'react';
import type { Plan } from '../model/types';
import { ZWECKE, setzeZweck, zweckGewaehlt } from '../model/zweck';

type Upd = (fn: (p: Plan) => void) => void;

/** Planzweck-Auswahl (Checkboxen, Mehrfachauswahl, mindestens einer) – in Schritt 0, Einführung und „Planzweck ändern“ */
export function ZweckAuswahl({ plan, upd, kompakt = false }: { plan: Plan; upd: Upd; kompakt?: boolean }) {
  const [hinweis, setHinweis] = useState('');
  const wechsel = (id: (typeof ZWECKE)[number]['id'], an: boolean) => {
    const probe = structuredClone(plan);
    if (!setzeZweck(probe, id, an)) { setHinweis('Mindestens ein Planzweck muss gewählt bleiben.'); return; }
    setHinweis('');
    upd(p => { setzeZweck(p, id, an); });
  };
  return <fieldset className={`zweck-auswahl ${kompakt ? 'kompakt' : ''}`} data-testid="zweck-auswahl">
    <legend className="sr-only">Planzweck</legend>
    {ZWECKE.map(z => <label key={z.id} className={`zweck-opt ${plan.zweck?.[z.id] ? 'on' : ''}`} data-testid={`zweck-${z.id}`}>
      <input type="checkbox" checked={!!plan.zweck?.[z.id]} onChange={ev => wechsel(z.id, ev.target.checked)} aria-label={z.label} />
      <span><b>{z.label}</b>{!kompakt && <small className="muted">{z.text}</small>}</span>
    </label>)}
    {!zweckGewaehlt(plan) && <small className="muted">Bitte mindestens einen Zweck wählen (Mehrfachauswahl möglich).</small>}
    {hinweis && <small className="neg" role="status">{hinweis}</small>}
    {plan.meta.zweckErgaenzt && <p className="zweck-alt" role="note" data-testid="zweck-altdatei">Dieser Plan stammt aus einer älteren Version ohne Planzweck. „Thüringer Mikrodarlehen (TAB)“ wurde voreingestellt – bitte prüfen und ggf. anpassen.</p>}
  </fieldset>;
}

/** Dialog „Planzweck ändern“ (Seitenleiste und ⋯-Menü) */
export function ZweckDialog({ plan, upd, onClose }: { plan: Plan; upd: Upd; onClose: () => void }) {
  return <div className="modal-bg" onKeyDown={ev => ev.key === 'Escape' && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-label="Planzweck ändern" data-testid="zweck-dialog">
    <h3>Wofür erstellen Sie den Finanzplan?</h3>
    <ZweckAuswahl plan={plan} upd={upd} />
    <p className="muted small">Mehrfachauswahl möglich. Bereiche, die nur für das Mikrodarlehen gebraucht werden (Kapitaldienstfähigkeit, Mikrodarlehen mit Tilgungsplan, Kontoauszugsanalyse), werden ohne diesen Zweck ausgeblendet – Ihre Eingaben dort bleiben erhalten und sind beim erneuten Anhaken wieder da.</p>
    <div className="row gap end"><button className="btn primary" autoFocus onClick={onClose}>Fertig</button></div>
  </div></div>;
}
