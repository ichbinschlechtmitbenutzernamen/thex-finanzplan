import type { Plan } from '../model/types';
import { leererPlan, SCHEMA_VERSION, PARAMS_2026 } from '../model/defaults';
import { standErgaenzen } from '../model/schritte';

const KEY = 'thex-finanzplan:v1';

/** Migration älterer Datenstände (schemaVersion) und Auffüllen fehlender Felder */
export function migriere(raw: any): Plan {
  const basis = leererPlan();
  if (!raw || typeof raw !== 'object') return basis;
  const p: Plan = { ...basis, ...raw };
  p.meta = { ...basis.meta, ...(raw.meta || {}) };
  p.einstellungen = { ...basis.einstellungen, ...(raw.einstellungen || {}) };
  p.projekt = { ...basis.projekt, ...(raw.projekt || {}) };
  p.params = { ...PARAMS_2026, ...(raw.params || {}) };
  p.kosten = { ...basis.kosten, ...(raw.kosten || {}) };
  p.eigenmittel = { ...basis.eigenmittel, ...(raw.eigenmittel || {}) };
  p.liquiditaet = { ...basis.liquiditaet, ...(raw.liquiditaet || {}) };
  p.stundensatz = { ...basis.stundensatz, ...(raw.stundensatz || {}) };
  // v1.0 → v1.1: „Auslastungsausfall“ wird zur Auslastungsquote
  if (raw.stundensatz && raw.stundensatz.auslastung === undefined && typeof raw.stundensatz.ausfall === 'number') p.stundensatz.auslastung = 1 - raw.stundensatz.ausfall;
  delete (p.stundensatz as any).ausfall;
  if (!Array.isArray(p.stundensatz.stundenFelder)) p.stundensatz.stundenFelder = [];
  p.meta.erledigt = { ...(p.meta.erledigt || {}) };
  p.meta.stand = { ...(p.meta.stand || {}) };
  p.sollIst = { ...basis.sollIst, ...(raw.sollIst || {}) };
  p.pruefung = { ...basis.pruefung, ...(raw.pruefung || {}) };
  if (!Array.isArray(p.darlehen) || p.darlehen.length === 0) p.darlehen = basis.darlehen;
  if (!Array.isArray(p.gruender) || p.gruender.length === 0) p.gruender = basis.gruender;
  p.schemaVersion = SCHEMA_VERSION;
  standErgaenzen(p);
  return p;
}

export function laden(): Plan {
  try { const s = localStorage.getItem(KEY); return s ? migriere(JSON.parse(s)) : leererPlan(); } catch { return leererPlan(); }
}
export function speichern(p: Plan) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* Speicher voll o. ä. */ }
}
export function loeschen() { localStorage.removeItem(KEY); }

export function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj: any, path: string, value: any) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = value;
}
