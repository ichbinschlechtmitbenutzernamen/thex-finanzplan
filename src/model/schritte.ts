import type { Plan } from './types';
import { berechne, privatKostenMonat, jahr, planFehler } from '../calc/plan';

export interface StepDef { id: string; nr: string; titel: string; nach: string[]; art: 'pflicht' | 'optional' | 'ergebnis'; sichtbar?: (p: Plan) => boolean; abschliessbar?: boolean; /** zusätzliche inhaltliche Abhängigkeiten (für „Bitte prüfen“) */ nutzt?: string[] }
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
  { id: 'szenarien', nr: '10a', titel: 'Szenarien', nach: ['steuern'], art: 'optional' },
  { id: 'stundensatz', nr: '11', titel: 'Stundensatz', nach: ['privat'], art: 'optional', nutzt: ['umsatz', 'personal', 'invest', 'kosten', 'darlehen', 'liquiditaet', 'steuern'] },
  { id: 'sollist', nr: '12', titel: 'Soll-Ist', nach: ['steuern'], art: 'optional', sichtbar: p => p.einstellungen.folgedarlehen },
  { id: 'pruefung', nr: 'P', titel: 'Prüfung (Kontoauszüge)', nach: ['privat'], art: 'optional', sichtbar: p => p.meta.pruefer },
];
export const stepById = (id: string) => STEPS.find(s => s.id === id);

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
    case 'liquiditaet': planFehler(berechne(p)).forEach(w => f.push(w.text)); break;
  }
  return f;
}

export function freigeschaltet(id: string, p: Plan, seen = new Set<string>()): boolean {
  const s = stepById(id)!;
  if (seen.has(id)) return false; seen.add(id);
  return s.nach.every(n => p.meta.erledigt[n] && freigeschaltet(n, p, seen));
}

// ---------------- „Bitte prüfen“ ----------------

/** Eingaben, die zu einem Schritt gehören (nur Eingaben, keine Ergebnisse) */
export function schrittEingaben(id: string, p: Plan): unknown {
  switch (id) {
    case 'start': return [p.einstellungen, p.meta.haftungBestaetigt];
    case 'projekt': return [p.projekt, p.gruender.map(g => [g.id, g.name, g.anteil])];
    case 'privat': return p.gruender.map(g => [g.privat.map(x => [x.bez, x.werte]), g.einnahmen, g.gzBetrag, g.gzVon, g.gzBis, g.kv, g.kvPrivatMonat, g.pvKind, g.grv, g.kirche, g.gfGehalt, g.gfSvPflichtig, g.ausschuettung]);
    case 'haushaltsbuch': return p.gruender.map(g => g.hb);
    case 'umsatz': return p.umsatz;
    case 'personal': return p.personal;
    case 'invest': return [p.invest, p.betriebskosten, p.gruendungskosten];
    case 'kosten': return p.kosten;
    case 'darlehen': return p.darlehen;
    case 'liquiditaet': return [p.eigenmittel, p.liquiditaet];
    case 'steuern': return p.params;
    case 'stundensatz': return p.stundensatz;
    case 'sollist': return p.sollIst;
    case 'pruefung': return [p.gruender.map(g => g.ka), p.pruefung];
    default: return null;
  }
}

/** FNV-1a über JSON – stabiler, kurzer Fingerabdruck */
export function fingerabdruck(v: unknown): string {
  const s = JSON.stringify(v) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Alle vorgelagerten Schritte (transitiv über „nach“ und „nutzt“), deren Eingaben den Schritt beeinflussen */
export function vorgelagert(id: string): string[] {
  const out = new Set<string>();
  const besuche = (x: string) => { const s = stepById(x); if (!s) return; for (const n of [...s.nach, ...(s.nutzt ?? [])]) if (!out.has(n)) { out.add(n); besuche(n); } };
  besuche(id);
  out.delete(id);
  return STEPS.map(s => s.id).filter(x => out.has(x));
}

export function standJetzt(id: string, p: Plan): Record<string, string> {
  return Object.fromEntries(vorgelagert(id).map(v => [v, fingerabdruck(schrittEingaben(v, p))]));
}

/** Schritt bestätigen: aktuellen Stand der vorgelagerten Eingaben merken */
export function bestaetige(id: string, p: Plan) { p.meta.stand[id] = standJetzt(id, p); }

/** Für erledigte Schritte ohne gespeicherten Stand (ältere Dateien, Beispiel) den aktuellen Stand übernehmen */
export function standErgaenzen(p: Plan) {
  p.meta.stand = p.meta.stand || {};
  for (const s of STEPS) if ((p.meta.erledigt[s.id] || (s.id === 'ergebnis' && p.meta.bestaetigtAm)) && !p.meta.stand[s.id]) bestaetige(s.id, p);
}

/** Je abgeschlossenem Schritt: Liste der vorgelagerten Schritte, die seit der Bestätigung geändert wurden */
export function bittePruefen(p: Plan): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const s of STEPS) {
    const done = s.id === 'ergebnis' ? !!p.meta.bestaetigtAm : !!p.meta.erledigt[s.id];
    const alt = p.meta.stand?.[s.id];
    if (!done || !alt) continue;
    const jetzt = standJetzt(s.id, p);
    const geaendert = Object.keys(jetzt).filter(k => k in alt ? alt[k] !== jetzt[k] : false);
    if (geaendert.length) r[s.id] = geaendert;
  }
  return r;
}

export type ErgebnisStatus = { status: 'bestaetigt' | 'offen' | 'veraltet'; text: string; gruende: string[]; /** blockierende Fehler (z. B. negative Liquidität) */ fehler: string[]; einreichungsfaehig: boolean };
/** Status des Ergebnisses (KD-Ampel/Dashboard): bestätigt, noch nie bestätigt oder nicht aktuell bestätigt */
export function ergebnisStatus(p: Plan, pruefen = bittePruefen(p)): ErgebnisStatus {
  const titel = (id: string) => stepById(id)?.titel ?? id;
  const pflichtOffen = STEPS.filter(s => s.art === 'pflicht' && !p.meta.erledigt[s.id]).map(s => s.id);
  const pflichtPruefen = STEPS.filter(s => s.art === 'pflicht' && pruefen[s.id]).map(s => s.id);
  const gruende = [
    ...pflichtPruefen.map(id => `„${titel(id)}“ bitte prüfen (geändert: ${pruefen[id].map(titel).join(', ')})`),
    ...(pruefen.ergebnis ? [`Eingaben geändert seit der letzten Bestätigung: ${pruefen.ergebnis.map(titel).join(', ')}`] : []),
  ];
  const fehlerListe = planFehler(berechne(p)).map(w => w.text);
  const basis = { gruende, fehler: fehlerListe };
  if (!p.meta.bestaetigtAm) return { ...basis, status: 'offen', text: pflichtOffen.length ? 'noch nicht bestätigt (Pflichtschritte offen)' : 'noch nicht bestätigt', einreichungsfaehig: false };
  if (gruende.length || pflichtOffen.length || fehlerListe.length) return { ...basis, status: 'veraltet', text: 'nicht aktuell bestätigt', einreichungsfaehig: false };
  return { ...basis, status: 'bestaetigt', text: `bestätigt am ${new Date(p.meta.bestaetigtAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`, einreichungsfaehig: true };
}
