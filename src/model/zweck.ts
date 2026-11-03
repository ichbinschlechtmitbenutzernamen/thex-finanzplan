import type { Plan, Zweck } from './types';

/** Planzweck (v1.3): Mehrfachauswahl, mindestens einer muss gewählt sein */
export type ZweckId = keyof Zweck;

export const ZWECKE: { id: ZweckId; label: string; kurz: string; text: string }[] = [
  { id: 'orientierung', label: 'Erste Schätzung / eigene Orientierung', kurz: 'Erste Schätzung', text: 'Zahlen grob durchrechnen, ohne Antrag. Weniger Pflichtangaben, Hinweise statt Sperren.' },
  { id: 'gz', label: 'Gründungszuschuss (Agentur für Arbeit)', kurz: 'Gründungszuschuss', text: 'Kapitalbedarf, Rentabilität und Liquidität (3 Jahre) für die Stellungnahme der fachkundigen Stelle.' },
  { id: 'md', label: 'Thüringer Mikrodarlehen (TAB)', kurz: 'Mikrodarlehen', text: 'Zusätzlich Darlehens- und Tilgungsplan, Kapitaldienstfähigkeit (KD) und Kontoauszugsanalyse.' },
];

const z = (p: Plan): Zweck => p.zweck ?? { orientierung: false, gz: false, md: true };
/** Mikrodarlehen gewählt: KD-Prüfung, Mikrodarlehen (Darlehen 1), Tilgungsplan, Kontoauszugsanalyse relevant */
export const mdAktiv = (p: Plan) => !!z(p).md;
/** Gründungszuschuss gewählt */
export const gzAktiv = (p: Plan) => !!z(p).gz;
/** Nur erste Schätzung (kein Antrag): weichere Pflichtfelder, Warnungen statt Fehler */
export const nurSchaetzung = (p: Plan) => !!z(p).orientierung && !z(p).gz && !z(p).md;
export const zweckGewaehlt = (p: Plan) => !!(z(p).orientierung || z(p).gz || z(p).md);

/** Kurzbezeichnung der gewählten Zwecke, z. B. „Gründungszuschuss · Mikrodarlehen“ */
export function zweckKurz(p: Plan): string {
  const l = ZWECKE.filter(x => z(p)[x.id]).map(x => x.kurz);
  return l.length ? l.join(' · ') : 'noch nicht gewählt';
}

/** Dokumenttitel nach Zweck (PDF, Excel) */
export function zweckTitel(p: Plan): string {
  if (mdAktiv(p) && gzAktiv(p)) return 'Finanzplan – Mikrodarlehen & Gründungszuschuss';
  if (mdAktiv(p)) return 'Finanzplan – Thüringer Mikrodarlehen';
  if (gzAktiv(p)) return 'Finanzplan – Gründungszuschuss';
  if (z(p).orientierung) return 'Finanzplan – erste Schätzung';
  return 'Finanzplan';
}

/** Kürzel für Dateinamen */
export function zweckDateiKuerzel(p: Plan): string {
  if (mdAktiv(p) && gzAktiv(p)) return 'TAB_GZ';
  if (mdAktiv(p)) return 'TAB';
  if (gzAktiv(p)) return 'GZ';
  return 'Schaetzung';
}

/** Zweck setzen; der letzte gewählte Zweck kann nicht abgewählt werden (false = abgelehnt) */
export function setzeZweck(p: Plan, id: ZweckId, an: boolean): boolean {
  const neu = { ...z(p), [id]: an };
  if (!an && zweckGewaehlt(p) && !(neu.orientierung || neu.gz || neu.md)) return false;
  p.zweck = neu;
  p.meta.zweckErgaenzt = false;
  return true;
}
