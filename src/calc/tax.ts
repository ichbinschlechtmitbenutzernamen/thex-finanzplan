import type { Params, Gruender } from '../model/types';

/** Einkommensteuer-Grundtarif § 32a EStG, lückenlose Zonen, zvE auf volle € abgerundet */
export function estTarif(zvE: number, p: Params): number {
  const x = Math.floor(Math.max(0, zvE));
  if (x <= p.estGrundfreibetrag) return 0;
  if (x <= p.estZ2) { const y = (x - p.estGrundfreibetrag) / 10000; return Math.floor((p.estK2a * y + p.estK2b) * y); }
  if (x <= p.estZ3) { const z = (x - p.estZ2) / 10000; return Math.floor((p.estK3a * z + p.estK3b) * z + p.estK3c); }
  if (x <= p.estZ4) return Math.floor(0.42 * x - p.estK4);
  return Math.floor(0.45 * x - p.estK5);
}

/** Solidaritätszuschlag mit Freigrenze und Milderungszone (Einzelveranlagung) */
export function soli(est: number, p: Params): number {
  if (est <= p.soliFreigrenze) return 0;
  return Math.min(est * p.soliSatz, (est - p.soliFreigrenze) * p.soliMilderung);
}

/** Gewerbesteuer (Jahr). freibetrag: Personenunternehmen 24.500 €, KapG 0 */
export function gewerbesteuer(gewinn: number, p: Params, freibetrag: number) {
  const basis = Math.max(0, gewinn - freibetrag);
  const messbetrag = Math.floor(basis / 100) * 100 * p.gewStMesszahl;
  return { messbetrag, gewSt: messbetrag * p.hebesatz };
}

/** KV/PV pro Jahr für Selbständige bzw. freiwillig Versicherte */
export function kvpv(basisJahr: number, g: Pick<Gruender, 'kv' | 'kvPrivatMonat' | 'pvKind'>, p: Params): number {
  if (g.kv === 'privat') return g.kvPrivatMonat * 12;
  const satz = p.kvSatz + p.kvZusatz + p.kvKrankengeld + (g.pvKind ? p.pvKind : p.pvKinderlos);
  const basis = Math.min(Math.max(basisJahr, p.kvMindestBemessungMonat * 12), p.kvBbg);
  return basis * satz;
}

export function grv(basisJahr: number, art: Gruender['grv'], p: Params): number {
  switch (art) {
    case 'einkommen': return Math.min(Math.max(0, basisJahr), p.grvBbg) * p.grvSatz;
    case 'regel': return p.grvRegelbeitrag * 12;
    case 'halb': return (p.grvRegelbeitrag / 2) * 12;
    default: return 0;
  }
}

export interface EStErgebnis { gewinn: number; kvpv: number; grv: number; sv: number; zvE: number; estTarif: number; anrechnung35: number; est: number; soli: number; kiSt: number; steuer: number }

/** Einzelunternehmer/GbR-Gesellschafter: ESt auf Gewinnanteil inkl. § 35-Anrechnung */
export function estPersonen(gewinnAnteil: number, g: Gruender, p: Params, messbetragAnteil: number, gewStAnteil: number): EStErgebnis {
  const kv = kvpv(Math.max(0, gewinnAnteil), g, p);
  const rv = grv(gewinnAnteil, g.grv, p);
  const zvE = Math.max(0, gewinnAnteil - kv - rv);
  const tarif = estTarif(zvE, p);
  const anr = Math.min(messbetragAnteil * Math.min(p.hebesatz, p.anrechnungsFaktor), gewStAnteil, tarif);
  const est = Math.max(0, tarif - anr);
  const so = soli(est, p);
  const ki = g.kirche ? est * p.kiStSatz : 0;
  return { gewinn: gewinnAnteil, kvpv: kv, grv: rv, sv: kv + rv, zvE, estTarif: tarif, anrechnung35: anr, est, soli: so, kiSt: ki, steuer: est + so + ki };
}

/** Gesellschafter-Geschäftsführer einer KapG: Gehalt + Ausschüttung */
export function estGf(gehaltJahr: number, ausschuettung: number, g: Gruender, p: Params) {
  let sv: number, kv = 0, rv = 0;
  if (g.gfSvPflichtig) { sv = Math.min(gehaltJahr, p.kvBbg) * p.anSv; }
  else { kv = gehaltJahr > 0 ? kvpv(gehaltJahr, g, p) : 0; rv = grv(gehaltJahr, g.grv, p); sv = kv + rv; }
  const zvE = Math.max(0, gehaltJahr - (gehaltJahr > 0 ? p.wkPausch : 0) - sv);
  const est = estTarif(zvE, p);
  const so = soli(est, p), ki = g.kirche ? est * p.kiStSatz : 0;
  const kapESt = Math.max(0, ausschuettung - p.sparerPausch) * p.kapEStSatz;
  const netto = gehaltJahr - sv - est - so - ki + ausschuettung - kapESt;
  return { gehalt: gehaltJahr, sv, zvE, est, soli: so, kiSt: ki, steuer: est + so + ki, ausschuettung, kapESt, netto };
}

export function kapGSteuern(ergebnis: number, p: Params) {
  const g = gewerbesteuer(Math.max(0, ergebnis), p, 0);
  const kst = Math.max(0, ergebnis) * p.kstSatz;
  return { messbetrag: g.messbetrag, gewSt: g.gewSt, kst, jahresueberschuss: ergebnis - g.gewSt - kst };
}
