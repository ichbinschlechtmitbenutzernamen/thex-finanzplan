import type { Gruender, Params, Plan, PrivatPosten, KostenPosten, Geschaeftsfeld, Darlehen } from './types';

export const SCHEMA_VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const z = (n: number) => Array.from({ length: n }, () => 0);

/** Zentrale Parameter 2026 (aus Vorlage V107 übernommen bzw. ergänzt; vor Release fachlich prüfen) */
export const PARAMS_2026: Params = {
  jahr: 2026,
  estGrundfreibetrag: 12348, estZ2: 17799, estZ3: 69878, estZ4: 277825,
  estK2a: 914.51, estK2b: 1400, estK3a: 173.10, estK3b: 2397, estK3c: 1034.87,
  estK4: 11135.63, estK5: 19470.38,
  soliSatz: 0.055, soliFreigrenze: 20350, soliMilderung: 0.119,
  kiStSatz: 0.09,
  gewStFreibetrag: 24500, gewStMesszahl: 0.035, hebesatz: 4.7, anrechnungsFaktor: 4.0,
  kstSatz: 0.15825, kapEStSatz: 0.26375, sparerPausch: 1000, wkPausch: 1230,
  kvSatz: 0.14, kvZusatz: 0.029, kvKrankengeld: 0.006, pvKinderlos: 0.042, pvKind: 0.036,
  kvBbg: 69750, kvMindestBemessungMonat: 1318.33,
  grvSatz: 0.186, grvBbg: 101400, grvRegelbeitrag: 735.63,
  agSv: 0.215, agMinijob: 0.315, anSv: 0.21, minijobGrenze1: 603, minijobGrenze2: 633, minijobWechselMonat: 0,
  kdGrenze: 0.95, kdGelb: 0.85,
  kontoauszugToleranz: 0.10,
};

const P = (gruppe: string, bez: string): PrivatPosten => ({ id: uid(), gruppe, bez, werte: [0, 0, 0] });

export function privatStandard(): PrivatPosten[] {
  return [
    P('Wohnen', 'Miete / Hausgeld'), P('Wohnen', 'Strom, Heizung, Nebenkosten'),
    P('Lebenshaltung', 'Lebensmittel, Drogerie'), P('Lebenshaltung', 'Kleidung'), P('Lebenshaltung', 'Telefon, Internet, Rundfunk'),
    P('Lebenshaltung', 'Freizeit, Urlaub'), P('Lebenshaltung', 'Sonstige Lebenshaltung'),
    P('Verpflichtungen', 'Unterhalt'), P('Verpflichtungen', 'Private Kredite / Leasing'),
    P('Versicherungen', 'Haftpflicht / Hausrat'), P('Versicherungen', 'Private Altersvorsorge'), P('Versicherungen', 'Sonstige Versicherungen'),
    P('Kfz privat', 'Kfz-Steuer und -Versicherung'), P('Kfz privat', 'Treibstoff / Laden'), P('Kfz privat', 'Reparatur, Reifen, TÜV'),
    P('Sonstiges', 'Sparrate / Rücklage'), P('Sonstiges', 'Sonstiges'),
  ];
}

export function neuerGruender(name = 'Gründer/in 1'): Gruender {
  return {
    id: uid(), name, anteil: 100, privat: privatStandard(), einnahmen: [0, 0, 0], gzBetrag: 0, gzVon: 1, gzBis: 6,
    kv: 'gesetzlich', kvPrivatMonat: 0, pvKind: false, grv: 'nein', kirche: false,
    gfGehalt: [0, 0, 0], gfSvPflichtig: false, ausschuettung: [0, 0, 0],
    hb: { anfang: 0, monate: Array.from({ length: 12 }, () => ({ ein: '', ende: 0 })) },
    ka: { anfang: 0, monate: Array.from({ length: 3 }, () => ({ ein: '', ende: 0 })) },
  };
}

const KOSTEN_STANDARD = [
  'Miete Geschäftsräume', 'Nebenkosten / Energie', 'Reinigung / Instandhaltung', 'Betriebliche Versicherungen',
  'Beiträge (IHK/HWK, BG, Verbände)', 'Kfz-Kosten (betrieblich)', 'Reisekosten', 'Werbung / Marketing',
  'Website / Software / Lizenzen', 'Telefon / Internet', 'Büromaterial / Porto', 'Steuerberatung / Buchhaltung',
  'Rechts- und Beratungskosten', 'Fortbildung', 'Leasing', 'Kontoführung / Zahlungsgebühren', 'Kosten Warenabgabe (Porto)',
  'Geringwertige Anschaffungen', 'Sonstige Kosten',
];
const steuerfrei = new Set(['Betriebliche Versicherungen', 'Beiträge (IHK/HWK, BG, Verbände)', 'Kontoführung / Zahlungsgebühren']);

export function kostenStandard(): KostenPosten[] {
  return KOSTEN_STANDARD.map(bez => ({ id: uid(), bez, ust: steuerfrei.has(bez) ? 0 : 0.19, monate: z(12) }));
}

export function neuesFeld(name = ''): Geschaeftsfeld {
  return { id: uid(), name, ust: 0.19, materialQuote: 0, preis: z(24), menge: z(24) };
}

export function mikrodarlehen(): Darlehen {
  return { id: uid(), bez: 'Mikrodarlehen TAB', betrag: 0, laufzeit: 84, tilgungsfrei: 12, sollzins: 0.024, effzins: 0.0243, auszahlungMonat: 1, art: 'tilgung', bestehend: false };
}

export function neuesDarlehen(bestehend = false): Darlehen {
  return { id: uid(), bez: bestehend ? 'Bestehender Kredit' : 'Weiteres Darlehen', betrag: 0, laufzeit: 60, tilgungsfrei: 0, sollzins: 0.05, effzins: 0.05, auszahlungMonat: 1, art: 'annuitaet', bestehend };
}

function naechsterMonat(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function leererPlan(): Plan {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { tutorialGesehen: false, haftungBestaetigt: false, erledigt: {}, pruefer: false, geaendert: new Date().toISOString(), stand: {}, bestaetigtAm: '' },
    einstellungen: { rechtsform: 'EU', kleinunternehmer: false, folgedarlehen: false, mehrgruender: false },
    projekt: { name: '', vorhaben: '', anschrift: '', telefon: '', email: '', branche: '', gemeinde: '', gruendungsmonat: naechsterMonat() },
    gruender: [neuerGruender()],
    umsatz: { felder: [neuesFeld('Geschäftsfeld 1')], faktor: Array.from({ length: 24 }, () => 1), wachstumJ3: 0.05 },
    personal: [],
    invest: [],
    betriebskosten: [],
    gruendungskosten: [],
    kosten: { posten: kostenStandard(), steigerungJ2: 0.03, steigerungJ3: 0.03, zuschuesse: [], aoErtrag: [], aoAufwand: [] },
    darlehen: [mikrodarlehen()],
    eigenmittel: { bar: 0, barMonat: 1, privatdarlehen: 0, privatdarlehenMonat: 1, sachzuschuss: 0, sachzuschussMonat: 1, sacheinlage: 0 },
    liquiditaet: { kaution: 0, kautionMonat: 1, ustModus: 'folgemonat' },
    params: { ...PARAMS_2026 },
    stundensatz: { aktiv: false, jahr: 1, arbeitstage: 260, urlaub: 24, krankheit: 5, feiertage: 10, stundenTag: 8, unproduktiv: 2, auslastung: 0.8, gewinnaufschlag: 3000, geplant: 0, stundenFelder: [] },
    sollIst: { monate: 12, ist: {} },
    pruefung: { vermerk: '', datum: '', pruefer: '', status: 'offen' },
  };
}
