import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import type { Plan } from '../model/types';
import { beispielPlan } from '../model/beispiel';
import { leererPlan } from '../model/defaults';
import { STEPS, fehler, weicheHinweise, sichtbar, schrittTitel, ergebnisStatus, standErgaenzen, bestaetige, bittePruefen } from '../model/schritte';
import { berechne, planFehler, liqFehlerRelevant } from '../calc/plan';
import { kvpv } from '../calc/tax';
import { migriere, laden, speichern, zuruecksetzen } from '../io/storage';
import { exportiere, importiere } from '../io/excel';
import { erstellePdf } from '../io/pdf';
import { setzeZweck, zweckTitel, zweckGewaehlt, nurSchaetzung, mdAktiv } from '../model/zweck';
import { folien } from '../ui/tutorial';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
beforeEach(() => { (globalThis as any).localStorage = new MemStorage(); });

type Z = Partial<Plan['zweck']>;
/** Muster Werkstatt mit gewähltem Zweck, alle Pflichtschritte abgeschlossen und bestätigt */
function fertig(z: Z): Plan {
  const p = beispielPlan();
  p.zweck = { orientierung: false, gz: false, md: false, ...z };
  p.meta.haftungBestaetigt = true;
  STEPS.filter(s => s.art === 'pflicht').forEach(s => (p.meta.erledigt[s.id] = true));
  standErgaenzen(p);
  p.meta.bestaetigtAm = '2026-11-02T19:00:00.000Z';
  bestaetige('ergebnis', p);
  return p;
}
/** Engpass: weniger Eigenmittel, kleineres Darlehen → negative Liquidität */
const engpass = (p: Plan) => { p.eigenmittel.bar = 0; p.darlehen[0].betrag = 5000; return p; };
const sichtbareIds = (p: Plan) => STEPS.filter(s => sichtbar(s.id, p)).map(s => s.id);
const seite1 = (doc: any) => (doc.internal.pages[1] as string[]).join('\n');
const alleSeiten = (doc: any) => (doc.internal.pages as string[][]).slice(1).map(x => x.join('\n')).join('\n');
const blaetter = async (buffer: ArrayBuffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); return wb.worksheets.map(w => w.name); };
const JETZT = new Date('2026-11-03T07:00:00Z');

describe('Leerer Plan: Ursache der −10.290 € und kein Liquiditätsfehler (v1.3)', () => {
  it('Ursache: KV-Mindestbeitrag (1.318,33 € × 12 × 21,7 %) als Privatentnahme über 36 Monate', () => {
    const p = leererPlan();
    const jahrKv = kvpv(0, p.gruender[0], p.params);
    expect(jahrKv).toBeCloseTo(1318.33 * 12 * (0.14 + 0.029 + 0.006 + 0.042), 2); // 3.432,93 €
    const e = berechne(p);
    expect(e.liq.tiefpunkt).toBeCloseTo(-3 * jahrKv, 1); // −10.298,79 €
    expect(Math.round(e.liq.tiefpunkt)).toBe(-10299);
    expect(e.liq.negMonate).toHaveLength(36);
  });
  it('… erzeugt aber keinen Fehler außerhalb des Schritts (Seitenleiste, Dashboard, PDF, Excel)', async () => {
    const p = leererPlan();
    const e = berechne(p);
    expect(e.liq.fehlerRelevant).toBe(false);
    expect(planFehler(e)).toEqual([]);
    expect(e.warnungen.some(w => w.schritt === 'liquiditaet')).toBe(false);
    expect(ergebnisStatus(p).fehler).toEqual([]);
    const r = await erstellePdf(p, JETZT);
    expect(r.dateiname).not.toMatch(/NICHT_EINREICHUNGSFAEHIG/);
    expect(alleSeiten(r.doc)).not.toMatch(/FEHLER: /);
  });
  it('… im Schritt Liquidität selbst bleibt er blockierend', () => {
    const p = leererPlan(); p.zweck.md = true;
    expect(fehler('liquiditaet', p)[0]).toMatch(/Liquidität negativ in 36 von 36 Monaten/);
  });
  it('Relevanz: ab Schritt 8 (Finanzierung abgeschlossen) bzw. sobald Umsatz + Kosten + Finanzierung erfasst sind', () => {
    const basis = { erledigt: {}, bestaetigt: false, umsatz: false, kosten: false, finanzierung: false };
    expect(liqFehlerRelevant(basis)).toBe(false);
    expect(liqFehlerRelevant({ ...basis, umsatz: true })).toBe(false);
    expect(liqFehlerRelevant({ ...basis, umsatz: true, kosten: true })).toBe(false);
    expect(liqFehlerRelevant({ ...basis, umsatz: true, kosten: true, erledigt: { kosten: true } })).toBe(true);
    expect(liqFehlerRelevant({ ...basis, umsatz: true, kosten: true, finanzierung: true })).toBe(true);
    expect(liqFehlerRelevant({ ...basis, erledigt: { darlehen: true } })).toBe(true);
    expect(liqFehlerRelevant({ ...basis, bestaetigt: true })).toBe(true);
    // Leerer Plan, nur Schritte 0–5 abgeschlossen → noch kein Fehler
    const p = leererPlan(); p.zweck.md = true; ['start', 'projekt', 'privat', 'umsatz', 'personal', 'invest'].forEach(id => (p.meta.erledigt[id] = true));
    expect(planFehler(berechne(p))).toEqual([]);
    p.meta.erledigt.darlehen = true; p.meta.erledigt.kosten = true;
    expect(planFehler(berechne(p))).toHaveLength(1);
  });
});

describe('Planzweck – Datenmodell (v1.3)', () => {
  it('neuer Plan: kein Zweck gewählt → Schritt 0 verlangt mindestens einen', () => {
    const p = leererPlan(); p.meta.haftungBestaetigt = true;
    expect(zweckGewaehlt(p)).toBe(false);
    expect(fehler('start', p)).toEqual(['Bitte wählen Sie mindestens einen Planzweck.']);
    p.zweck.gz = true;
    expect(fehler('start', p)).toEqual([]);
  });
  it('der letzte gewählte Zweck kann nicht abgewählt werden', () => {
    const p = leererPlan();
    expect(setzeZweck(p, 'gz', true)).toBe(true);
    expect(setzeZweck(p, 'gz', false)).toBe(false);
    expect(p.zweck.gz).toBe(true);
    expect(setzeZweck(p, 'md', true)).toBe(true);
    expect(setzeZweck(p, 'gz', false)).toBe(true);
    expect(p.zweck).toEqual({ orientierung: false, gz: false, md: true });
  });
  it('Reset setzt den Planzweck zurück', () => {
    const p = fertig({ gz: true, md: true }); speichern(p);
    expect(laden().zweck).toEqual({ orientierung: false, gz: true, md: true });
    const r = zuruecksetzen();
    expect(r.zweck).toEqual({ orientierung: false, gz: false, md: false });
    expect(laden().zweck).toEqual({ orientierung: false, gz: false, md: false });
  });
  it('alte Daten (v1.0–v1.2) ohne Zweck: Mikrodarlehen voreingestellt + Hinweis-Flag', () => {
    const alt: any = JSON.parse(JSON.stringify(fertig({ md: true }))); delete alt.zweck; alt.schemaVersion = 1; delete alt.meta.zweckErgaenzt;
    const p = migriere(alt);
    expect(p.zweck).toEqual({ orientierung: false, gz: false, md: true });
    expect(p.meta.zweckErgaenzt).toBe(true);
    expect(p.schemaVersion).toBe(2);
    // ändert der Nutzer den Zweck, verschwindet der Hinweis
    setzeZweck(p, 'gz', true);
    expect(p.meta.zweckErgaenzt).toBe(false);
  });
});

describe('Szenario: nur erste Schätzung', () => {
  const z = { orientierung: true };
  it('Navigation ohne Kontoauszugsanalyse und Soll-Ist; Ergebnis ohne „KD-Prüfung“', () => {
    const p = fertig(z); p.meta.pruefer = true; p.einstellungen.folgedarlehen = true;
    const ids = sichtbareIds(p);
    expect(ids).not.toContain('pruefung'); expect(ids).not.toContain('sollist');
    expect(ids).toEqual(expect.arrayContaining(['invest', 'darlehen', 'liquiditaet', 'ergebnis']));
    expect(schrittTitel('ergebnis', p)).toBe('Ergebnis');
    expect(nurSchaetzung(p)).toBe(true);
  });
  it('weichere Pflichtfelder: Name und private Kosten nur Hinweise', () => {
    const p = leererPlan(); p.zweck.orientierung = true; p.gruender[0].name = '';
    expect(fehler('projekt', p)).toEqual([]);
    expect(weicheHinweise('projekt', p)).toEqual(['Projekt- bzw. Firmenname fehlt.', 'Bitte alle Namen eintragen.']);
    expect(fehler('privat', p)).toEqual([]);
    expect(weicheHinweise('privat', p)[0]).toMatch(/private Kosten für Jahr 1 fehlen/);
    expect(fehler('umsatz', p)).toEqual(['Bitte planen Sie Umsätze für Jahr 1.']); // Umsatz bleibt Pflicht
    // mit Antragszweck wieder streng
    p.zweck.gz = true;
    expect(fehler('projekt', p)).toContain('Projekt- bzw. Firmenname fehlt.');
    expect(weicheHinweise('projekt', p)).toEqual([]);
  });
  it('negative Liquidität: Warnung statt Fehler, Ergebnis bleibt bestätigbar', async () => {
    const p = engpass(fertig(z));
    const e = berechne(p);
    expect(e.liq.negMonate.length).toBeGreaterThan(0);
    expect(planFehler(e)).toEqual([]);
    const w = e.warnungen.find(x => x.schritt === 'liquiditaet')!;
    expect(w).toMatchObject({ schwer: true }); expect(w.fehler).toBeFalsy();
    expect(w.text).toMatch(/Warnhinweis/);
    expect(fehler('liquiditaet', p)).toEqual([]);
    expect(weicheHinweise('liquiditaet', p)[0]).toMatch(/Liquidität negativ/);
    expect(ergebnisStatus(p).fehler).toEqual([]);
    const r = await erstellePdf(p, JETZT);
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_Schaetzung_2026-11-03.pdf');
    expect(seite1(r.doc)).toMatch(/Finanzplan \x96 erste Schätzung/);
    expect(seite1(r.doc)).toMatch(/Erste Schätzung, nicht zur Einreichung bestimmt/);
  });
  it('kein Mikrodarlehen in Rechnung, KD-Warnungen und Excel', async () => {
    const p = fertig(z);
    const e = berechne(p);
    expect(e.darlehen[0].d.betrag).toBe(0);
    expect(p.darlehen[0].betrag).toBe(beispielPlan().darlehen[0].betrag); // Daten bleiben erhalten
    expect(e.warnungen.some(w => /KD|Kapitaldienst|Betrag zwischen/.test(w.text))).toBe(false);
    const { buffer } = await exportiere(p);
    const b = await blaetter(buffer);
    expect(b).not.toContain('KD_Pruefung'); expect(b).not.toContain('Pruefung');
  });
});

describe('Szenario: nur Gründungszuschuss', () => {
  const z = { gz: true };
  it('MD-Bereiche aus Navigation und Freischaltung, KD kein Abschlusskriterium', () => {
    const p = fertig(z); p.meta.pruefer = true;
    expect(sichtbareIds(p)).not.toContain('pruefung');
    expect(schrittTitel('ergebnis', p)).toBe('Ergebnis');
    expect(ergebnisStatus(p).gruende).toEqual([]);
    p.darlehen[0].betrag = 999999; p.darlehen[0].laufzeit = 200; // ungültiges (ausgeblendetes) MD stört nicht
    expect(fehler('darlehen', p)).toEqual([]);
    expect(ergebnisStatus(p).fehler.every(f => /Liquidität negativ/.test(f))).toBe(true);
  });
  it('Finanzierung ohne Mikrodarlehen; Liquidität bleibt relevant und blockierend', () => {
    const p = fertig(z);
    const mitMd = berechne(fertig({ md: true }));
    const e = berechne(p);
    expect(e.finanzierung).toBeCloseTo(mitMd.finanzierung - p.darlehen[0].betrag, 2);
    expect(e.kd.kapitaldienst).toBe(0);
    // Muster Werkstatt ohne Mikrodarlehen → Liquidität negativ → Fehler (GZ ist ein Antrag)
    expect(e.liq.negMonate.length).toBeGreaterThan(0);
    expect(planFehler(e)).toHaveLength(1);
    expect(fehler('liquiditaet', p)[0]).toMatch(/nicht einreichungsfähig/);
    p.eigenmittel.bar += 25000;
    expect(planFehler(berechne(p))).toEqual([]);
  });
  it('PDF: Titel „Finanzplan – Gründungszuschuss“, GZ-Abschnitte, keine KD-Seite, Dateiname _GZ_', async () => {
    const p = fertig(z); p.eigenmittel.bar += 25000;
    const r = await erstellePdf(p, JETZT);
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_GZ_2026-11-03.pdf');
    const s1 = seite1(r.doc), alle = alleSeiten(r.doc);
    expect(s1).toMatch(/Finanzplan \x96 Gründungszuschuss/); // Gedankenstrich in WinAnsi kodiert
    expect(s1).toMatch(/Unterlagen Gründungszuschuss/);
    expect(s1).not.toMatch(/Beantragtes Mikrodarlehen/);
    expect(s1).not.toMatch(/Thüringer Aufbaubank/);
    expect(alle).toMatch(/Kapitalbedarfsplan und Finanzierung/);
    expect(alle).toMatch(/Rentabilitätsvorschau \\\(3 Jahre\\\)/);
    expect(alle).toMatch(/Liquiditätsplan \\\(3 Jahre, brutto\\\)/);
    expect(alle).not.toMatch(/Rechenweg/);
  });
  it('Excel: Zweck im Projektblatt, ohne KD-Blatt, ohne Mikrodarlehen-Spalte; Titel nach Zweck', async () => {
    const p = fertig(z);
    const { buffer } = await exportiere(p);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const namen = wb.worksheets.map(w => w.name);
    expect(namen).not.toContain('KD_Pruefung');
    expect(String(wb.getWorksheet('Dashboard')!.getCell('A1').value)).toMatch(/^Finanzplan – Gründungszuschuss: Muster Werkstatt/);
    expect(String(wb.getWorksheet('Rentabilitaet')!.getCell('A1').value)).toBe('Rentabilitätsvorschau (3 Jahre)');
    const dl = wb.getWorksheet('Darlehen')!;
    const texte: string[] = []; dl.eachRow(r => r.eachCell(c => texte.push(String(c.value))));
    expect(texte.join('|')).toMatch(/Darlehen 1 \(Mikrodarlehen\) ist ausgeblendet/);
    expect(texte.join('|')).not.toMatch(/Tilgungsplan/);
    const pj = wb.getWorksheet('Projekt')!; const pt: string[] = []; pj.eachRow(r => r.eachCell(c => pt.push(String(c.value))));
    expect(pt.join('|')).toMatch(/Planzweck: Gründungszuschuss/);
    expect(pt.join('|')).not.toMatch(/KD-Grenzwert/);
  });
  it('Plausibilitätshinweis, wenn kein Gründungszuschuss eingetragen ist', () => {
    const p = fertig(z);
    expect(berechne(p).warnungen.some(w => /Planzweck Gründungszuschuss/.test(w.text))).toBe(true);
    p.gruender[0].gzBetrag = 1500;
    expect(berechne(p).warnungen.some(w => /Planzweck Gründungszuschuss/.test(w.text))).toBe(false);
  });
});

describe('Szenario: nur Mikrodarlehen (Verhalten wie v1.2)', () => {
  const z = { md: true };
  it('alle MD-Bereiche, KD-Prüfung, PDF für TAB', async () => {
    const p = fertig(z); p.meta.pruefer = true;
    expect(sichtbareIds(p)).toContain('pruefung');
    expect(schrittTitel('ergebnis', p)).toBe('Ergebnis & KD-Prüfung');
    p.darlehen[0].betrag = 50000;
    expect(fehler('darlehen', p)[0]).toMatch(/Mikrodarlehen: Betrag zwischen 5.000/);
    const q = fertig(z);
    const r = await erstellePdf(q, JETZT);
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_TAB_2026-11-03.pdf');
    expect(seite1(r.doc)).toMatch(/Beantragtes Mikrodarlehen/);
    expect(alleSeiten(r.doc)).toMatch(/Rechenweg/);
    const b = await blaetter((await exportiere(q)).buffer);
    expect(b).toContain('KD_Pruefung');
    expect(ergebnisStatus(q).einreichungsfaehig).toBe(true);
  });
});

describe('Szenario: alle drei Zwecke', () => {
  it('streng (Antrag), MD-Bereiche sichtbar, Titel und Dateiname kombiniert', async () => {
    const p = fertig({ orientierung: true, gz: true, md: true });
    expect(nurSchaetzung(p)).toBe(false);
    expect(mdAktiv(p)).toBe(true);
    expect(zweckTitel(p)).toBe('Finanzplan – Mikrodarlehen & Gründungszuschuss');
    p.projekt.name = '';
    expect(fehler('projekt', p)).toContain('Projekt- bzw. Firmenname fehlt.');
    p.projekt.name = 'Muster Werkstatt';
    const r = await erstellePdf(p, JETZT);
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_TAB_GZ_2026-11-03.pdf');
    expect(seite1(r.doc)).toMatch(/Beantragtes Mikrodarlehen/);
    expect(alleSeiten(r.doc)).toMatch(/Kapitalbedarfsplan/);
    expect(engpass(p) && planFehler(berechne(p))).toHaveLength(1);
  });
});

describe('Umschalten: Daten ausgeblendeter Bereiche bleiben erhalten', () => {
  it('MD ab- und wieder anwählen', () => {
    const p = fertig({ md: true, gz: true });
    p.meta.pruefer = true; p.gruender[0].ka.anfang = 1234;
    const vorher = JSON.stringify({ d: p.darlehen, ka: p.gruender[0].ka, pr: p.pruefung });
    const kdVorher = berechne(p).kd.kapitaldienst;
    expect(kdVorher).toBeGreaterThan(0);
    setzeZweck(p, 'md', false);
    expect(sichtbareIds(p)).not.toContain('pruefung');
    expect(berechne(p).kd.kapitaldienst).toBe(0);
    // Ergebnis gilt als „nicht aktuell bestätigt“, weil sich der Zweck geändert hat
    expect(bittePruefen(p).ergebnis).toEqual(['zweck']);
    expect(ergebnisStatus(p).gruende[0]).toMatch(/Planzweck/);
    setzeZweck(p, 'md', true);
    expect(JSON.stringify({ d: p.darlehen, ka: p.gruender[0].ka, pr: p.pruefung })).toBe(vorher);
    expect(berechne(p).kd.kapitaldienst).toBeCloseTo(kdVorher, 6);
    expect(sichtbareIds(p)).toContain('pruefung');
    expect(bittePruefen(p).ergebnis).toBeUndefined();
  });
  it('Einführung passt sich an', () => {
    const p = leererPlan();
    expect(folien(p).map(f => f.titel)).toHaveLength(4);
    p.zweck.md = true;
    expect(folien(p).map(f => f.titel)).toContain('Was ist Kapitaldienstfähigkeit?');
    p.zweck = { orientierung: false, gz: true, md: false };
    const t = folien(p).map(f => f.titel);
    expect(t).toContain('Gründungszuschuss'); expect(t).not.toContain('Was ist Kapitaldienstfähigkeit?');
    p.zweck = { orientierung: true, gz: false, md: false };
    expect(folien(p).map(f => f.titel)).toContain('Erste Schätzung');
  });
});

describe('Excel: Planzweck im Export und Re-Import', () => {
  it('Round-Trip behält den Zweck; Änderung in Excel wird erkannt', async () => {
    const p = fertig({ gz: true, orientierung: true });
    const { buffer } = await exportiere(p);
    const r = await importiere(buffer);
    expect(r.plan.zweck).toEqual({ orientierung: true, gz: true, md: false });
    expect(r.aenderungen).toEqual([]);
    expect(r.meta.zweckErgaenzt).toBe(false);
    // in Excel Mikrodarlehen anhaken
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const dws = wb.getWorksheet('_daten')!;
    let addr = '';
    dws.eachRow(row => { if (row.getCell(5).value === 'zweck.md') addr = String(row.getCell(4).value); });
    expect(addr).not.toBe('');
    wb.getWorksheet('Projekt')!.getCell(addr).value = 'ja';
    const r2 = await importiere((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r2.aenderungen.map(a => a.path)).toEqual(['zweck.md']);
    expect(r2.plan.zweck.md).toBe(true);
  });
  it('alle Zwecke in Excel abgewählt → Zweck aus dem Datenblock bleibt', async () => {
    const p = fertig({ gz: true });
    const { buffer } = await exportiere(p);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const dws = wb.getWorksheet('_daten')!;
    dws.eachRow(row => { if (row.getCell(5).value === 'zweck.gz') wb.getWorksheet('Projekt')!.getCell(String(row.getCell(4).value)).value = 'nein'; });
    const r = await importiere((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r.plan.zweck.gz).toBe(true);
    expect(r.aenderungen.some(a => a.path.startsWith('zweck.'))).toBe(false);
  });
  it('alte Datei (v1.2, ohne Zweck) → Mikrodarlehen + Hinweis', async () => {
    const alt: any = fertig({ md: true }); delete alt.zweck; alt.schemaVersion = 1;
    const { buffer } = await exportiere(alt); // so sah der Datenblock bis v1.2 aus (kein „zweck“)
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const daten = wb.getWorksheet('_daten')!;
    daten.getCell('A3').value = '1.2.0';
    let json = ''; for (let row = 10; daten.getCell(row, 1).value; row++) json += String(daten.getCell(row, 1).value);
    expect(JSON.parse(json).zweck).toBeUndefined();
    const r = await importiere((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r.meta.appVersion).toBe('1.2.0');
    expect(r.meta.zweckErgaenzt).toBe(true);
    expect(r.plan.zweck).toEqual({ orientierung: false, gz: false, md: true });
    expect(r.plan.meta.zweckErgaenzt).toBe(true);
    expect(sichtbar('pruefung', { ...r.plan, meta: { ...r.plan.meta, pruefer: true } })).toBe(true);
  });
});
