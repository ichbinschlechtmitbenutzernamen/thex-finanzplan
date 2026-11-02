import { describe, it, expect } from 'vitest';
import { berechne, stundensatz, szenario, szenarioPlan, umsatzPuffer, PLAUSI, jahr, planFehler } from '../calc/plan';
import { beispielPlan } from '../model/beispiel';
import { leererPlan, privatStandard, kostenStandard, uid } from '../model/defaults';
import { STEPS, bestaetige, bittePruefen, ergebnisStatus, standErgaenzen, fingerabdruck } from '../model/schritte';
import { HILFE, hilfe, hilfeText, abgedeckteQuellen, ORIENTIERUNG_LABEL } from '../model/hilfe';
import { migriere } from '../io/storage';
import { exportiere, importiere } from '../io/excel';
import { erstellePdf, pdfText } from '../io/pdf';
import type { Plan } from '../model/types';

/** Beispielplan mit allen Pflichtschritten abgeschlossen und bestätigt */
function fertig(): Plan {
  const p = beispielPlan();
  p.meta.haftungBestaetigt = true;
  STEPS.filter(s => s.art === 'pflicht').forEach(s => (p.meta.erledigt[s.id] = true));
  standErgaenzen(p);
  p.meta.bestaetigtAm = '2026-11-02T19:00:00.000Z';
  bestaetige('ergebnis', p);
  return p;
}
const texte = (p: Plan) => berechne(p).warnungen.map(w => w.text).join('\n');
const plausi = (p: Plan) => berechne(p).warnungen.filter(w => w.plausi);

describe('„Bitte prüfen“ (Abhängigkeiten)', () => {
  it('frisch bestätigter Plan: nichts zu prüfen, Ergebnis bestätigt', () => {
    const p = fertig();
    expect(bittePruefen(p)).toEqual({});
    expect(ergebnisStatus(p).status).toBe('bestaetigt');
  });
  it('Änderung der privaten Kosten markiert alle späteren Schritte, nicht aber den Schritt selbst', () => {
    const p = fertig();
    p.gruender[0].privat[0].werte = [900, 900, 900];
    const r = bittePruefen(p);
    expect(r.privat).toBeUndefined();
    expect(r.projekt).toBeUndefined();
    for (const id of ['umsatz', 'personal', 'invest', 'kosten', 'darlehen', 'liquiditaet', 'steuern', 'ergebnis']) expect(r[id], id).toContain('privat');
    const st = ergebnisStatus(p);
    expect(st.status).toBe('veraltet');
    expect(st.text).toBe('nicht aktuell bestätigt');
    expect(st.gruende.join(' ')).toMatch(/Umsatzplanung/);
  });
  it('Änderung im letzten Pflichtschritt betrifft nur das Ergebnis', () => {
    const p = fertig();
    p.params.hebesatz = 4.2;
    const r = bittePruefen(p);
    expect(Object.keys(r)).toEqual(['ergebnis']);
    expect(r.ergebnis).toEqual(['steuern']);
  });
  it('erneutes Bestätigen hebt die Markierung auf', () => {
    const p = fertig();
    p.umsatz.felder[0].preis[0] = 60;
    expect(Object.keys(bittePruefen(p))).toContain('kosten');
    ['personal', 'invest', 'kosten', 'darlehen', 'liquiditaet', 'steuern', 'ergebnis'].forEach(id => bestaetige(id, p));
    expect(bittePruefen(p)).toEqual({});
    expect(ergebnisStatus(p).status).toBe('bestaetigt');
  });
  it('Stundensatz (optional) hängt von allen inhaltlichen Pflichtschritten ab', () => {
    const p = fertig(); p.meta.erledigt.stundensatz = true; bestaetige('stundensatz', p);
    p.kosten.posten[0].monate[0] = 999;
    expect(bittePruefen(p).stundensatz).toContain('kosten');
  });
  it('nie bestätigtes Ergebnis: Status „offen“', () => {
    const p = beispielPlan(); standErgaenzen(p);
    expect(ergebnisStatus(p).status).toBe('offen');
  });
  it('Fingerabdruck ist deterministisch und reagiert auf Änderungen', () => {
    expect(fingerabdruck({ a: 1, b: [1, 2] })).toBe(fingerabdruck({ a: 1, b: [1, 2] }));
    expect(fingerabdruck({ a: 1 })).not.toBe(fingerabdruck({ a: 2 }));
  });
  it('Excel-Import mit geänderter Zelle markiert abhängige Schritte', async () => {
    const p = fertig();
    const { buffer } = await exportiere(p);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    let geaendert = false;
    wb.getWorksheet('Projekt')!.eachRow(r => r.eachCell(c => { if (!geaendert && typeof c.value === 'number' && Math.abs((c.value as number) - p.params.hebesatz) < 1e-9) { c.value = 4.5; geaendert = true; } }));
    expect(geaendert).toBe(true);
    const r = await importiere(await wb.xlsx.writeBuffer() as ArrayBuffer);
    expect(r.aenderungen.length).toBe(1);
    expect(bittePruefen(r.plan).ergebnis).toEqual(['steuern']);
    expect(ergebnisStatus(r.plan).status).toBe('veraltet');
  });
});

describe('Migration v1.0 → v1.1', () => {
  it('ausfall wird zu auslastung, stand wird ergänzt', () => {
    const alt: any = structuredClone(beispielPlan());
    alt.stundensatz = { ...alt.stundensatz, ausfall: 0.1 }; delete alt.stundensatz.auslastung; delete alt.stundensatz.geplant; delete alt.stundensatz.stundenFelder;
    delete alt.meta.stand; delete alt.meta.bestaetigtAm;
    alt.meta.erledigt = { start: true, projekt: true, privat: true };
    const m = migriere(alt);
    expect(m.stundensatz.auslastung).toBeCloseTo(0.9, 9);
    expect((m.stundensatz as any).ausfall).toBeUndefined();
    expect(m.stundensatz.stundenFelder).toEqual([]);
    expect(m.meta.bestaetigtAm).toBe('');
    expect(Object.keys(m.meta.stand).sort()).toEqual(['privat', 'projekt', 'start']);
    expect(bittePruefen(m)).toEqual({});
  });
});

describe('Plausibilitätswarnungen (nicht blockierend)', () => {
  it('Beispielplan ist ohne Plausibilitätswarnungen', () => { expect(plausi(beispielPlan())).toEqual([]); });
  it('voller Umsatz ab Monat 1', () => {
    const p = beispielPlan(); p.umsatz.faktor = p.umsatz.faktor.map(() => 1); p.umsatz.felder.forEach(f => (f.menge = f.menge.map(() => 80)));
    expect(texte(p)).toMatch(/Monat 1 .* auf vollem Niveau/);
  });
  it('extremer Umsatzsprung J1 → J2', () => {
    const p = beispielPlan(); p.umsatz.felder.forEach(f => f.menge.forEach((_, m) => { if (m >= 12) f.menge[m] *= 3; }));
    expect(texte(p)).toMatch(/steigt von Jahr 1 auf Jahr 2 um \d+ %/);
  });
  it('Fahrzeug ohne Kfz-Kosten', () => {
    const p = beispielPlan(); p.invest.push({ id: uid(), bez: 'Transporter', netto: 12000, ust: 0.19, monat: 1, ndJahre: 6, gwg: false });
    p.kosten.posten.find(k => /Kfz/.test(k.bez))!.monate.fill(0);
    expect(texte(p)).toMatch(/Fahrzeug geplant \(.*Transporter.*\), aber keine laufenden Kfz-Kosten/);
    p.kosten.posten.find(k => /Kfz/.test(k.bez))!.monate.fill(150);
    expect(texte(p)).not.toMatch(/Fahrzeug geplant/);
  });
  it('Finanzierungslücke (schwer)', () => {
    const p = beispielPlan(); p.invest[0].netto = 40000;
    const w = berechne(p).warnungen.find(x => /Finanzierungslücke/.test(x.text))!;
    expect(w).toBeTruthy(); expect(w.schwer).toBe(true); expect(w.schritt).toBe('darlehen');
  });
  it('Privatentnahme / private Kosten unter Minimum', () => {
    const p = beispielPlan(); const g = p.gruender[0]; g.privat.forEach(x => (x.werte = [0, 0, 0])); g.privat[0].werte = [500, 500, 500]; g.einnahmen = [800, 800, 800];
    const t = texte(p);
    expect(t).toMatch(new RegExp(`unter dem Orientierungswert von ${PLAUSI.privatMinimum.toLocaleString('de-DE')}`));
    expect(t).toMatch(/deckt weniger als die Hälfte/);
  });
  it('Null- und unplausible Werte', () => {
    const p = beispielPlan(); p.umsatz.felder[1].menge.fill(0); p.darlehen[0].sollzins = 0; p.params.hebesatz = 1.5;
    p.kosten.posten.find(k => /Steuerberatung/.test(k.bez))!.monate.fill(0);
    const t = texte(p);
    expect(t).toMatch(/Preis eingetragen, aber keine Mengen/); expect(t).toMatch(/Sollzins 0,00 % ist unplausibel/); expect(t).toMatch(/Hebesatz 150 % ist unplausibel/); expect(t).toMatch(/Steuerberatung/);
  });
  it('KD in gelber Zone', () => {
    const p = beispielPlan();
    // Umsatz so weit senken, dass die Auslastung zwischen Gelb- und Grenzwert liegt
    const pu = umsatzPuffer(p)!;
    const gelb = szenarioPlan(p, { umsatz: pu + 0.005, kosten: 0 });
    const e = berechne(gelb);
    expect(e.kd.ampel).toBe('gelb');
    expect(e.warnungen.some(w => w.plausi && /gelben Zone/.test(w.text))).toBe(true);
  });
  it('Warnungen sind nicht blockierend: Pflichtfehler bleiben unverändert', async () => {
    const { fehler } = await import('../model/schritte');
    const p = beispielPlan(); p.invest[0].netto = 40000;
    expect(fehler('invest', p)).toEqual([]); expect(fehler('darlehen', p)).toEqual([]);
  });
});

describe('Stundensatz rückwärts', () => {
  it('Satz = zu deckender Betrag / fakturierbare Stunden; Bestandteile summieren sich', () => {
    const p = beispielPlan(); const e = berechne(p); const s = stundensatz(p, e);
    const basis = s.privatKosten + s.sv + s.est - s.einnahmen + s.betrieb + s.kapitaldienst + s.steuern + s.ausschuettung + s.gewinnaufschlag - s.rohertragAndere;
    expect(s.basis).toBeCloseTo(Math.max(0, basis), 6);
    expect(s.stunden).toBeCloseTo(s.tage * s.hTag * p.stundensatz.auslastung, 6);
    expect(s.satz).toBeCloseTo(s.basis / s.stunden, 6);
    expect(s.tagessatz).toBeCloseTo(s.satz * s.hTag, 6);
    expect(s.privatKosten).toBeCloseTo(p.gruender[0].privat.reduce((a, x) => a + x.werte[0], 0) * 12, 6);
  });
  it('Rohertrag nicht stundenbasierter Geschäftsfelder wird abgezogen', () => {
    const p = beispielPlan(); const e = berechne(p);
    const mit = stundensatz(p, e); p.stundensatz.stundenFelder = []; const ohne = stundensatz(p, e);
    expect(mit.rohertragAndere).toBeGreaterThan(0); expect(ohne.rohertragAndere).toBe(0);
    expect(mit.satz).toBeLessThan(ohne.satz);
    expect(mit.andereFelder).toEqual(['Ersatzteile & Zubehör']);
  });
  it('Vergleich mit geplantem Satz', () => {
    const p = beispielPlan(); const s = stundensatz(p, berechne(p));
    expect(s.geplant).toBe(55);
    expect(s.differenz).toBeCloseTo(55 - s.satz, 6);
    expect(s.deckung).toBeCloseTo(55 / s.satz, 6);
    expect(s.stundenNoetig * 55).toBeCloseTo(s.basis, 4);
    expect(s.auslastungNoetig).toBeCloseTo(s.stundenNoetig / s.produktiv, 6);
  });
  it('geringere Auslastung → höherer Satz', () => {
    const p = beispielPlan(); const e = berechne(p); const a = stundensatz(p, e).satz; p.stundensatz.auslastung = 0.5;
    expect(stundensatz(p, e).satz).toBeCloseTo(a * 0.8 / 0.5, 6);
  });
});

describe('Szenarien', () => {
  it('überschreiben die Eingaben nicht', () => {
    const p = beispielPlan(); const vorher = JSON.stringify(p);
    szenario(p, { umsatz: -0.3, kosten: 0.2 }); umsatzPuffer(p);
    expect(JSON.stringify(p)).toBe(vorher);
  });
  it('Basis-Szenario entspricht dem Plan', () => {
    const p = beispielPlan(); const e = berechne(p); const s = szenario(p, { umsatz: 0, kosten: 0 });
    expect(s.kdAuslastung).toBeCloseTo(e.kd.auslastung, 9); expect(s.liqMin).toBeCloseTo(e.liq.tiefpunkt, 6); expect(s.be).toEqual(e.jahre.map(j => j.betriebsergebnis));
  });
  it('monoton: weniger Umsatz / mehr Kosten verschlechtern KD, Liquidität und Ergebnis', () => {
    const p = beispielPlan();
    const a = szenario(p, { umsatz: 0, kosten: 0 }), b = szenario(p, { umsatz: -0.1, kosten: 0 }), c = szenario(p, { umsatz: -0.1, kosten: 0.1 });
    expect(b.kdAuslastung).toBeGreaterThan(a.kdAuslastung); expect(c.kdAuslastung).toBeGreaterThan(b.kdAuslastung);
    expect(b.liqMin).toBeLessThanOrEqual(a.liqMin); expect(c.liqMin).toBeLessThanOrEqual(b.liqMin);
    expect(b.be[1]).toBeLessThan(a.be[1]); expect(c.be[1]).toBeLessThan(b.be[1]);
  });
  it('Umsatz ±% skaliert den Umsatz proportional', () => {
    const p = beispielPlan(); const e = berechne(p); const s = szenario(p, { umsatz: -0.2, kosten: 0 });
    expect(jahr(s.e.umsatz, 1)).toBeCloseTo(jahr(e.umsatz, 1) * 0.8, 4);
  });
  it('Umsatzpuffer: knapp darüber gelb/grün, knapp darunter rot', () => {
    const p = beispielPlan(); const pu = umsatzPuffer(p)!;
    expect(pu).toBeLessThan(0); expect(pu).toBeGreaterThan(-1);
    expect(szenario(p, { umsatz: pu + 0.002, kosten: 0 }).ampel).not.toBe('rot');
    expect(szenario(p, { umsatz: pu - 0.002, kosten: 0 }).ampel).toBe('rot');
  });
});

describe('Hilfetexte aus der Vorlage V107', () => {
  // Zellen mit Kommentaren in der Vorlage (48) – Autorennamen wurden bewusst nicht übernommen
  const KOMMENTARE = ['Abgabenrechner!A18', 'Abgabenrechner!A22', 'Abgabenlast Kapitalgesellschaft!A25', 'Abgabenlast Kapitalgesellschaft!A29', 'a. Kosten privat!A18', 'a. Kosten privat!A20', 'a. Kosten privat!A27', 'a. Kosten privat!A28', 'a. Kosten privat!A37', 'Haushaltsbuch!C2', 'Haushaltsbuch!D2', 'Haushaltsbuch!F2', 'd. & e. Kapitalbedarfsplan!B20', 'f. Investitionsplan!C3', 'f. Investitionsplan!E3', 'g. Darlehensplan!B14', 'g. Darlehensplan!B28', 'g. Darlehensplan!B42', 'h. Detail-RentaV!C87', 'h. Detail-RentaV!C94', 'h. Detail-RentaV!C95', 'i. RentaV-Übersicht!A9', 'i. RentaV-Übersicht!A11', 'i. RentaV-Übersicht!A13', 'i. RentaV-Übersicht!A15', 'i. RentaV-Übersicht!A24', 'i. RentaV-Übersicht!A25', 'i. RentaV-Übersicht!A26', 'i. RentaV-Übersicht!A28', 'i. RentaV-Übersicht!A29', 'i. RentaV-Übersicht!A35', 'i. RentaV-Übersicht!A40', 'j. Detail-Liquiditätsplan!B67', 'j. Detail-Liquiditätsplan!B69', 'j. Detail-Liquiditätsplan!B76', 'j. Detail-Liquiditätsplan!B87', 'k. Ust-Zahllast!A6', 'l. Stundensatz-Kalk.!B3', 'l. Stundensatz-Kalk.!B8', 'l. Stundensatz-Kalk.!B9', 'l. Stundensatz-Kalk.!B10', 'l. Stundensatz-Kalk.!B18', 'l. Stundensatz-Kalk.!B19', 'l. Stundensatz-Kalk.!B20', 'l. Stundensatz-Kalk.!B23', 'l. Stundensatz-Kalk.!B26', 'l. Stundensatz-Kalk.!B27', 'l. Stundensatz-Kalk.!B30'];
  // Blätter mit Textfeldern (11 Textfelder auf 9 Blättern)
  const TEXTFELDER = ['Projektdaten', 'a. Kosten privat', 'Haushaltsbuch', 'b. Personalplanung', 'c. Umsatzplanung', 'd. & e. Kapitalbedarfsplan', 'f. Investitionsplan', 'g. Darlehensplan', 'h. Detail-RentaV'];
  it('alle 48 Kommentare sind abgedeckt', () => { expect(KOMMENTARE.length).toBe(48); const q = abgedeckteQuellen(); expect(KOMMENTARE.filter(k => !q.has(k))).toEqual([]); });
  it('alle Textfeld-Blätter sind abgedeckt', () => { const q = abgedeckteQuellen(); expect(TEXTFELDER.filter(t => !q.has(`${t} (Textfeld)`))).toEqual([]); });
  it('keine Personennamen (Kommentar-Autoren) in Hilfetexten', () => {
    for (const [k, h] of Object.entries(HILFE)) { expect(h.text, k).not.toMatch(/^[A-ZÄÖÜ][\wäöüßè-]+, [A-ZÄÖÜ][\wäöüßè-]+:/); expect(h.text, k).not.toMatch(/\b(Thiel|Mario)\b/); }
  });
  it('Schlüssel für Tabellenzeilen passen zu den Standardpositionen', () => {
    const privat = new Set(privatStandard().map(x => x.bez)), kosten = new Set(kostenStandard().map(x => x.bez));
    const SONDER = ['allgemein', 'est', 'kv', 'grv', 'einnahmen', 'abgleich', 'steigerung', 'gemeinkosten'];
    for (const k of Object.keys(HILFE)) {
      const [bereich, rest] = [k.split('.')[0], k.slice(k.indexOf('.') + 1)];
      if (bereich === 'privat' && !SONDER.includes(rest)) expect(privat.has(rest), k).toBe(true);
      if (bereich === 'kosten' && !SONDER.includes(rest)) expect(kosten.has(rest), k).toBe(true);
    }
  });
  it('Orientierungswerte sind als unverbindlich gekennzeichnet', () => {
    const mitO = Object.keys(HILFE).filter(k => hilfe(k)?.orientierung);
    expect(mitO.length).toBeGreaterThanOrEqual(15);
    expect(ORIENTIERUNG_LABEL).toMatch(/unverbindlich/i);
    expect(hilfeText(mitO[0])).toMatch(/Orientierungswert \(unverbindlich\)/);
    expect(hilfeText(mitO[0])).toMatch(/Quelle: Vorlage V107/);
  });
});

/** Beispiel mit Liquiditätsengpass (weniger Eigenmittel, kleineres Darlehen) */
function engpass(p = fertig()): Plan { p.eigenmittel.bar = 0; p.darlehen[0].betrag = 5000; return p; }

describe('Negative Liquidität ist ein Fehler (v1.1)', () => {
  it('Beispiel „Muster Werkstatt“ hat im Basisfall keine negative Liquidität', () => {
    const e = berechne(beispielPlan());
    expect(e.liq.negMonate).toEqual([]);
    expect(Math.min(...e.liq.kumuliert)).toBeGreaterThanOrEqual(0);
    expect(planFehler(e)).toEqual([]);
    expect(ergebnisStatus(fertig()).einreichungsfaehig).toBe(true);
  });
  it('negativer Monat erzeugt genau einen Fehler (kein Plausibilitätshinweis) im Schritt Liquidität', () => {
    const e = berechne(engpass());
    const f = planFehler(e);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ schritt: 'liquiditaet', fehler: true, schwer: true });
    expect(f[0].plausi).toBeFalsy();
    expect(f[0].text).toMatch(/Liquidität negativ in \d+ von 36 Monaten .*nicht einreichungsfähig/);
    expect(e.warnungen.some(w => w.plausi && /Liquidität/.test(w.text) && /negativ/.test(w.text))).toBe(false);
  });
  it('schon ein einziger negativer Monat zählt', () => {
    const p = beispielPlan(); const e0 = berechne(p);
    // Bareinlage genau so weit senken, dass nur der Tiefpunkt knapp unter 0 fällt
    p.eigenmittel.bar -= e0.liq.tiefpunkt + 1;
    const e = berechne(p);
    expect(e.liq.negMonate.length).toBeGreaterThanOrEqual(1);
    expect(planFehler(e)).toHaveLength(1);
  });
  it('Schritt Liquidität kann nicht abgeschlossen werden', async () => {
    const { fehler } = await import('../model/schritte');
    expect(fehler('liquiditaet', beispielPlan())).toEqual([]);
    expect(fehler('liquiditaet', engpass())[0]).toMatch(/Liquidität negativ/);
  });
  it('Ergebnis gilt nicht als bestätigt / einreichungsfähig, solange der Fehler besteht', () => {
    const st = ergebnisStatus(engpass());
    expect(st.fehler).toHaveLength(1);
    expect(st.einreichungsfaehig).toBe(false);
    expect(st.status).not.toBe('bestaetigt');
  });
  it('Szenarien markieren negative Liquidität als Fehler, ohne den Basisplan zu sperren', () => {
    const p = fertig();
    const r = szenario(p, { umsatz: -0.3, kosten: 0.15 });
    expect(r.liqFehler).toBe(true); expect(r.liqNegMonate).toBeGreaterThan(0);
    expect(szenario(p, { umsatz: 0, kosten: 0 }).liqFehler).toBe(false);
    expect(ergebnisStatus(p).einreichungsfaehig).toBe(true);
  });
  it('PDF und Excel markieren den Plan als „nicht einreichungsfähig“', async () => {
    const r = await erstellePdf(engpass(), new Date('2026-11-02T19:00:00Z'));
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_TAB_2026-11-02_NICHT_EINREICHUNGSFAEHIG.pdf');
    const seite1 = (r.doc.internal as unknown as { pages: string[][] }).pages[1].join('\n');
    expect(seite1).toMatch(/FEHLER: Plan nicht einreichungsf/);
    expect(seite1).toMatch(/NICHT EINREICHUNGSF/);
    const ok = await erstellePdf(fertig(), new Date('2026-11-02T19:00:00Z'));
    expect((ok.doc.internal as unknown as { pages: string[][] }).pages[1].join('\n')).not.toMatch(/EINREICHUNGSF/);
    const ExcelJS = (await import('exceljs')).default;
    const { blob } = await exportiere(engpass());
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await blob.arrayBuffer());
    expect(String(wb.getWorksheet('Dashboard')!.getCell(13, 6).value)).toMatch(/NICHT EINREICHUNGSFÄHIG/);
  });
});

describe('PDF für die TAB', () => {
  it('erzeugt ein gültiges PDF mit allen Abschnitten', async () => {
    const p = fertig(); p.stundensatz.aktiv = true;
    const r = await erstellePdf(p, new Date('2026-11-02T19:00:00Z'));
    const buf = new Uint8Array(r.doc.output('arraybuffer')), td = new TextDecoder('latin1');
    expect(td.decode(buf.subarray(0, 5))).toBe('%PDF-');
    expect(td.decode(buf.subarray(-6))).toMatch(/%%EOF/);
    expect(r.seiten).toBeGreaterThanOrEqual(6);
    expect(r.dateiname).toBe('Finanzplan_Muster_Werkstatt_TAB_2026-11-02.pdf');
  });
  it('funktioniert auch mit leerem Plan und mit Warnungen', async () => {
    const leer = await erstellePdf(leererPlan());
    expect(leer.seiten).toBeGreaterThanOrEqual(5);
    const p = beispielPlan(); p.invest[0].netto = 60000; p.eigenmittel.bar = 0;
    const w = await erstellePdf(p);
    expect(w.seiten).toBeGreaterThanOrEqual(6);
  });
  it('Text wird für die PDF-Standardschrift bereinigt', () => {
    expect(pdfText('−5 € „Test“ ✓ ↻ ≥ 3')).toBe('-5 € „Test“   >= 3');
    expect(pdfText('Äöüß – …')).toBe('Äöüß – …');
  });
});
