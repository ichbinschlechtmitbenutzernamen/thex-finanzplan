// Datenmodell (nur Eingaben). Alle Ergebnisse berechnet der Rechenkern (src/calc).
export type Rechtsform = 'EU' | 'FREI' | 'GBR' | 'KAPG';
export type KvArt = 'gesetzlich' | 'privat';
export type GrvArt = 'nein' | 'einkommen' | 'regel' | 'halb';
export type DarlehenArt = 'tilgung' | 'annuitaet';
export type UstModus = 'sofort' | 'folgemonat' | 'dfv' | 'quartal';
export type StelleArt = 'sv' | 'minijob';

/** Wert je Planjahr (Monatsbetrag) */
export type J3 = [number, number, number];

export interface PrivatPosten { id: string; gruppe: string; bez: string; werte: J3 }

export interface Gruender {
  id: string;
  name: string;
  /** Gewinnanteil bei GbR in % */
  anteil: number;
  privat: PrivatPosten[];
  /** private Einnahmen je Planjahr (Monatsbetrag): Partner/sonstige */
  einnahmen: J3;
  gzBetrag: number;   // Gründungszuschuss/Einstiegsgeld je Monat
  gzVon: number;      // Planmonat
  gzBis: number;
  kv: KvArt;
  kvPrivatMonat: number;
  pvKind: boolean;
  grv: GrvArt;
  kirche: boolean;
  // KapG
  gfGehalt: J3;       // brutto je Monat
  gfSvPflichtig: boolean;
  ausschuettung: J3;  // je Jahr (Betrag p. a.)
  // Haushaltsbuch (optional): 12 Monate
  hb: { anfang: number; monate: { ein: string; ende: number }[] };
  // Kontoauszugsanalyse (Prüfer)
  ka: { anfang: number; monate: { ein: string; ende: number }[] };
}

export interface Geschaeftsfeld {
  id: string; name: string; ust: number; materialQuote: number;
  preis: number[]; // 24
  menge: number[]; // 24
}

export interface Stelle { id: string; bez: string; art: StelleArt; brutto: number; von: number; bis: number }
export interface Investition { id: string; bez: string; netto: number; ust: number; monat: number; ndJahre: number; gwg: boolean }
export interface Einmalkosten { id: string; bez: string; netto: number; ust: number; monat: number }
export interface KostenPosten { id: string; bez: string; ust: number; monate: number[] /* 12 */ }
export interface Zeitraumbetrag { id: string; bez: string; betrag: number; von: number; bis: number }
export interface Darlehen {
  id: string; bez: string; betrag: number; laufzeit: number; tilgungsfrei: number;
  sollzins: number; effzins: number; auszahlungMonat: number; art: DarlehenArt;
  /** bestehender Kredit: bereits ausgezahlt, keine Einzahlung im Plan */
  bestehend: boolean;
}

export interface Params {
  jahr: number;
  estGrundfreibetrag: number; estZ2: number; estZ3: number; estZ4: number;
  estK2a: number; estK2b: number; estK3a: number; estK3b: number; estK3c: number;
  estK4: number; estK5: number;
  soliSatz: number; soliFreigrenze: number; soliMilderung: number;
  kiStSatz: number;
  gewStFreibetrag: number; gewStMesszahl: number; hebesatz: number; anrechnungsFaktor: number;
  kstSatz: number; kapEStSatz: number; sparerPausch: number; wkPausch: number;
  kvSatz: number; kvZusatz: number; kvKrankengeld: number; pvKinderlos: number; pvKind: number;
  kvBbg: number; kvMindestBemessungMonat: number;
  grvSatz: number; grvBbg: number; grvRegelbeitrag: number;
  agSv: number; agMinijob: number; anSv: number; minijobGrenze1: number; minijobGrenze2: number; minijobWechselMonat: number;
  kdGrenze: number; kdGelb: number;
  kontoauszugToleranz: number;
}

export interface Stundensatz {
  aktiv: boolean; jahr: 1 | 2 | 3; arbeitstage: number; urlaub: number; krankheit: number; feiertage: number;
  stundenTag: number; unproduktiv: number; ausfall: number; gewinnaufschlag: number;
}

export interface Plan {
  schemaVersion: number;
  meta: { tutorialGesehen: boolean; haftungBestaetigt: boolean; erledigt: Record<string, boolean>; pruefer: boolean; geaendert: string };
  einstellungen: { rechtsform: Rechtsform; kleinunternehmer: boolean; folgedarlehen: boolean; mehrgruender: boolean };
  projekt: { name: string; vorhaben: string; anschrift: string; telefon: string; email: string; branche: string; gemeinde: string; gruendungsmonat: string /* YYYY-MM */ };
  gruender: Gruender[];
  umsatz: { felder: Geschaeftsfeld[]; faktor: number[] /*24*/; wachstumJ3: number };
  personal: Stelle[];
  invest: Investition[];
  betriebskosten: Einmalkosten[];
  gruendungskosten: Einmalkosten[];
  kosten: { posten: KostenPosten[]; steigerungJ2: number; steigerungJ3: number; zuschuesse: Zeitraumbetrag[]; aoErtrag: Zeitraumbetrag[]; aoAufwand: Zeitraumbetrag[] };
  darlehen: Darlehen[]; // [0] = Mikrodarlehen
  eigenmittel: { bar: number; barMonat: number; privatdarlehen: number; privatdarlehenMonat: number; sachzuschuss: number; sachzuschussMonat: number; sacheinlage: number };
  liquiditaet: { kaution: number; kautionMonat: number; ustModus: UstModus };
  params: Params;
  stundensatz: Stundensatz;
  sollIst: { monate: number; ist: Record<string, number> };
  pruefung: { vermerk: string; datum: string; pruefer: string; status: 'offen' | 'geprueft' | 'nachbesserung' };
}
