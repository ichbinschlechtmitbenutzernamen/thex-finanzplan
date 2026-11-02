import { describe, it, expect } from 'vitest';
import { PARAMS_2026, leererPlan, neuerGruender, mikrodarlehen, neuesDarlehen } from '../model/defaults';
import { estTarif, soli, gewerbesteuer, estPersonen, kapGSteuern } from '../calc/tax';
import { tilgungsplan, darlehenReihen } from '../calc/loans';
import { berechne, jahr, summeAusText, kontoAnalyse, stundensatz } from '../calc/plan';
import { beispielPlan } from '../model/beispiel';
import { exportiere, importiere } from '../io/excel';
import ExcelJS from 'exceljs';

const p = PARAMS_2026;

describe('ESt-Tarif 2026 (§ 32a)', () => {
  it('Grundfreibetrag ist steuerfrei', () => { expect(estTarif(12348, p)).toBe(0); expect(estTarif(0, p)).toBe(0); expect(estTarif(-500, p)).toBe(0); });
  it('Zonen sind lückenlos und stetig', () => {
    for (const g of [p.estZ2, p.estZ3, p.estZ4]) { const a = estTarif(g, p), b = estTarif(g + 1, p); expect(b - a).toBeGreaterThanOrEqual(0); expect(b - a).toBeLessThan(1.5); }
  });
  it('Referenzwerte', () => {
    expect(estTarif(17799, p)).toBe(1034);   // Ende Zone 2
    expect(estTarif(69878, p)).toBe(18213);  // Ende Zone 3
    expect(estTarif(100000, p)).toBe(30864); // 0,42·100000 − 11135,63
    expect(estTarif(300000, p)).toBe(115529);
  });
  it('Soli: Freigrenze und Milderungszone', () => { expect(soli(20350, p)).toBe(0); expect(soli(21000, p)).toBeCloseTo(650 * 0.119, 5); expect(soli(100000, p)).toBeCloseTo(5500, 5); });
});

describe('Gewerbesteuer', () => {
  it('Freibetrag, Abrundung auf volle 100 €, Messzahl 3,5 %, Hebesatz 470 %', () => {
    const g = gewerbesteuer(50000, p, 24500);
    expect(g.messbetrag).toBeCloseTo(892.5, 6);
    expect(g.gewSt).toBeCloseTo(4194.75, 6); // Vorlage Abgabenrechner
    expect(gewerbesteuer(20000, p, 24500).gewSt).toBe(0);
    expect(gewerbesteuer(50099, p, 24500).gewSt).toBeCloseTo(4194.75, 6);
  });
  it('KapG ohne Freibetrag, KSt 15,825 %', () => { const k = kapGSteuern(50000, p); expect(k.gewSt).toBeCloseTo(50000 * 0.035 * 4.7, 6); expect(k.kst).toBeCloseTo(7912.5, 6); expect(kapGSteuern(-1000, p).kst).toBe(0); });
});

describe('ESt Einzelunternehmer inkl. § 35', () => {
  it('Vorlage-Abgabenrechner: Gewinn 50.000 €, KV-Zusatz 2,69 % → ESt 3.404 €', () => {
    const pv = { ...p, kvZusatz: 0.0269 };
    const g = neuerGruender();
    const gw = gewerbesteuer(50000, pv, 24500);
    const r = estPersonen(50000, g, pv, gw.messbetrag, gw.gewSt);
    expect(r.kvpv).toBeCloseTo(50000 * (0.14 + 0.0269 + 0.006 + 0.042), 4);
    expect(r.est).toBeCloseTo(3404, 6);
  });
  it('Anrechnung § 35 nie höher als Tarif-ESt', () => {
    const g = neuerGruender(); const gw = gewerbesteuer(30000, p, 0);
    const r = estPersonen(30000, g, p, gw.messbetrag, gw.gewSt);
    expect(r.anrechnung35).toBeLessThanOrEqual(r.estTarif); expect(r.est).toBeGreaterThanOrEqual(0);
  });
  it('KV-Mindestbemessung greift bei Verlust', () => {
    const r = estPersonen(-5000, neuerGruender(), p, 0, 0);
    expect(r.kvpv).toBeCloseTo(1318.33 * 12 * (0.14 + 0.029 + 0.006 + 0.042), 4); expect(r.est).toBe(0);
  });
});

describe('Darlehen', () => {
  it('Mikrodarlehen 10.000 € / 84 Mon. / 12 tilgungsfrei / 2,4 %: konstante Tilgung', () => {
    const d = { ...mikrodarlehen(), betrag: 10000 };
    const t = tilgungsplan(d);
    expect(t).toHaveLength(84);
    expect(t[0].zins).toBeCloseTo(20, 6); expect(t[0].tilgung).toBe(0);
    expect(t[12].tilgung).toBeCloseTo(10000 / 72, 6); expect(t[12].zins).toBeCloseTo(20, 6);
    expect(t[13].zins).toBeCloseTo((10000 - 10000 / 72) * 0.002, 6);
    expect(t[83].restEnde).toBe(0);
    expect(t.reduce((s, z) => s + z.tilgung, 0)).toBeCloseTo(10000, 6);
  });
  it('Vorlage rechnet mit Effektivzins 2,43 % → 243 € Zinsen im 1. Jahr (Vergleichswert)', () => {
    const t = tilgungsplan({ ...mikrodarlehen(), betrag: 10000, sollzins: 0.0243 });
    expect(t.slice(0, 12).reduce((s, z) => s + z.zins, 0)).toBeCloseTo(243, 6);
  });
  it('Annuitätendarlehen: konstante Rate, Restschuld 0', () => {
    const d = { ...neuesDarlehen(), betrag: 20000, laufzeit: 60, sollzins: 0.06 };
    const t = tilgungsplan(d);
    const r = 0.005, A = 20000 * r / (1 - Math.pow(1 + r, -60));
    expect(A).toBeCloseTo(386.66, 2);
    t.slice(0, 59).forEach(z => expect(z.rate).toBeCloseTo(A, 6));
    expect(t[59].restEnde).toBe(0); expect(t[59].rate).toBeCloseTo(A, 4);
  });
  it('Annuität mit tilgungsfreier Zeit: erst nur Zins', () => {
    const t = tilgungsplan({ ...neuesDarlehen(), betrag: 12000, laufzeit: 48, tilgungsfrei: 6, sollzins: 0.05, art: 'annuitaet' });
    expect(t[5].tilgung).toBe(0); expect(t[5].zins).toBeCloseTo(50, 6); expect(t[6].tilgung).toBeGreaterThan(0); expect(t[47].restEnde).toBe(0);
  });
  it('Auszahlung im Monat 3 verschiebt den Plan; bestehende Kredite ohne Einzahlung', () => {
    const r = darlehenReihen({ ...mikrodarlehen(), betrag: 10000, auszahlungMonat: 3 });
    expect(r.auszahlung[2]).toBe(10000); expect(r.zins[0]).toBe(0); expect(r.zins[2]).toBeCloseTo(20, 6);
    const b = darlehenReihen({ ...neuesDarlehen(true), betrag: 5000 });
    expect(b.auszahlung.every(x => x === 0)).toBe(true); expect(b.zins[0]).toBeGreaterThan(0);
  });
  it('ungültige Konditionen liefern leeren Plan', () => { expect(tilgungsplan({ ...mikrodarlehen(), betrag: 10000, laufzeit: 12, tilgungsfrei: 12 })).toEqual([]); });
});

describe('Gesamtplan / KD', () => {
  const plan = beispielPlan();
  const e = berechne(plan);
  it('Rentabilität: Betriebsergebnis = Ertrag − Aufwand', () => {
    for (let m = 0; m < 36; m++) expect(e.betriebsergebnis[m]).toBeCloseTo(e.betriebsertrag[m] - e.material[m] - e.personal[m] - e.afa[m] - e.zinsen[m] - e.kosten[m] - e.einmal[m], 6);
  });
  it('Kosten Jahr 2/3 mit Steigerungsraten', () => { expect(jahr(e.kosten, 2)).toBeCloseTo(jahr(e.kosten, 1) * 1.03, 6); expect(jahr(e.kosten, 3)).toBeCloseTo(jahr(e.kosten, 1) * 1.03 * 1.03, 6); });
  it('Umsatz Jahr 3 = Jahr 2 × (1 + Wachstum)', () => expect(jahr(e.umsatz, 3)).toBeCloseTo(jahr(e.umsatz, 2) * 1.05, 6));
  it('AfA: linear monatlich, GWG sofort', () => { expect(e.afa[0]).toBeCloseTo(9000 / 120 + 4200 / 84 + 1800 / 36 + 750, 6); expect(e.afa[1]).toBeCloseTo(9000 / 120 + 4200 / 84 + 1800 / 36, 6); });
  it('Liquidität: kumuliert = Summe der Salden', () => { expect(e.liq.kumuliert[35]).toBeCloseTo(e.liq.saldo.reduce((a, b) => a + b, 0), 6); });
  it('USt: Summe Zahlungen = Summe Zahllast ohne letzten Monat (Folgemonat)', () => { expect(e.ust.zahlung.reduce((a, b) => a + b, 0)).toBeCloseTo(e.ust.zahllast.slice(0, 35).reduce((a, b) => a + b, 0), 6); });
  it('KD-Formel: Grenze = Zufluss − Entnahmen − GewSt − andere KD', () => {
    const k = e.kd;
    expect(k.zufluss).toBeCloseTo(k.be2 + k.afa2 + k.zinsD1, 6);
    expect(k.grenze).toBeCloseTo(k.zufluss - k.entnahmen - k.gewSt2 - k.kdAndere, 6);
    expect(k.entnahmen).toBeCloseTo(k.entnahmenDetail[0].privat + k.entnahmenDetail[0].sv + k.entnahmenDetail[0].est, 6);
    expect(k.entnahmenDetail[0].privat).toBe(1290 * 12);
    expect(k.kapitaldienst).toBeCloseTo(jahr(e.zinsen, 2) + jahr(e.tilgung, 2), 6);
  });
  it('Max. Darlehen führt genau zu 95 % Auslastung', () => {
    const k = e.kd;
    const p2 = beispielPlan(); p2.darlehen[0].betrag = k.maxDarlehen;
    const d = darlehenReihen(p2.darlehen[0]);
    const kd2 = jahr(d.zins, 2) + jahr(d.tilgung, 2);
    expect(kd2 / k.grenze).toBeCloseTo(0.95, 6);
  });
  it('Ampel: rot, wenn KD-Grenze ≤ 0', () => {
    const p2 = beispielPlan(); p2.gruender[0].privat[0].werte = [6000, 6000, 6000];
    const e2 = berechne(p2); expect(e2.kd.grenze).toBeLessThan(0); expect(e2.kd.ampel).toBe('rot');
  });
  it('anderer Kredit mindert die KD-Grenze um seinen Kapitaldienst', () => {
    const p2 = beispielPlan(); p2.darlehen.push({ ...neuesDarlehen(true), betrag: 10000, laufzeit: 48, sollzins: 0.06 });
    const e2 = berechne(p2);
    expect(e2.kd.kdAndere).toBeGreaterThan(0);
  });
  it('GbR: Gewinn nach Anteilen verteilt, Entnahmen beider Gesellschafter', () => {
    const p2 = beispielPlan(); p2.einstellungen.rechtsform = 'GBR';
    const g2 = neuerGruender('Erika'); g2.privat[0].werte = [500, 500, 500]; p2.gruender.push(g2);
    p2.gruender[0].anteil = 60; g2.anteil = 40;
    const e2 = berechne(p2);
    expect(e2.steuerJahre[1].personen[0].gewinn).toBeCloseTo(e2.steuerJahre[1].ergebnis * 0.6, 6);
    expect(e2.kd.entnahmenDetail).toHaveLength(2);
  });
  it('KapG: GF-Gehalt im Personalaufwand, KSt und Ausschüttung in der KD', () => {
    const p2 = beispielPlan(); p2.einstellungen.rechtsform = 'KAPG';
    p2.gruender[0].gfGehalt = [2000, 2500, 2500]; p2.gruender[0].ausschuettung = [0, 5000, 5000];
    const e2 = berechne(p2);
    expect(e2.personal[0]).toBeCloseTo(2000, 6);
    expect(e2.kd.kst2).toBeGreaterThan(0); expect(e2.kd.ausschuettung2).toBe(5000);
    expect(e2.kd.grenze).toBeCloseTo(e2.kd.zufluss - 5000 - e2.kd.gewSt2 - e2.kd.kst2, 6);
    expect(e2.kd.tragfaehigkeit).toHaveLength(1);
  });
  it('Kleinunternehmer: keine USt', () => { const p2 = beispielPlan(); p2.einstellungen.kleinunternehmer = true; const e2 = berechne(p2); expect(e2.ust.zahllast.every(x => x === 0)).toBe(true); });
  it('Leerer Plan rechnet ohne Fehler', () => { const e0 = berechne(leererPlan()); expect(e0.kd.grenze).toBeLessThanOrEqual(0); expect(e0.liq.kumuliert.every(isFinite)).toBe(true); });
});

describe('Hilfsfunktionen', () => {
  it('Haushaltsbuch-Summe aus Text', () => { expect(summeAusText('100+50,5+20')).toBeCloseTo(170.5); expect(summeAusText('=1.200+300')).toBe(1500); expect(summeAusText('')).toBe(0); });
  it('Kontoauszugsanalyse', () => { const a = kontoAnalyse(1000, [{ ein: '2000', ende: 1200 }, { ein: '2000', ende: 1000 }]); expect(a.zeilen[0].aus).toBe(1800); expect(a.zeilen[1].aus).toBe(2200); expect(a.avgAus).toBe(2000); });
  it('Stundensatz positiv', () => { const pl = beispielPlan(); const s = stundensatz(pl, berechne(pl)); expect(s.stunden).toBeCloseTo((260 - 24 - 5 - 10) * 6 * 0.95, 6); expect(s.satz).toBeGreaterThan(0); });
});

describe('Excel Export → Import (Round-Trip)', () => {
  it('unverändert: keine Änderungen, Hash ok', async () => {
    const plan = beispielPlan();
    const { buffer } = await exportiere(plan);
    const r = await importiere(buffer);
    expect(r.meta.hashOk).toBe(true);
    expect(r.aenderungen).toEqual([]);
    expect(r.plan.projekt.name).toBe('Muster Werkstatt');
    expect(JSON.stringify(berechne(r.plan).kd)).toBe(JSON.stringify(berechne(plan).kd));
  });
  it('in Excel geänderte Eingabezellen werden erkannt', async () => {
    const plan = beispielPlan();
    const { buffer } = await exportiere(plan);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    expect(wb.worksheets[0].name).toBe('Dashboard');
    expect(wb.getWorksheet('_daten')!.state).toBe('veryHidden');
    // Darlehensbetrag und eine private Kostenposition ändern
    const dws = wb.getWorksheet('_daten')!;
    let addrBetrag = '', addrMiete = '';
    dws.eachRow((row, i) => { if (i < 2) return; const path = row.getCell(5).value; if (path === 'darlehen.0.betrag') addrBetrag = String(row.getCell(4).value); if (path === 'gruender.0.privat.0.werte.0') addrMiete = String(row.getCell(4).value); });
    wb.getWorksheet('Darlehen')!.getCell(addrBetrag).value = 30000;
    wb.getWorksheet('Privat')!.getCell(addrMiete).value = 650;
    const neu = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const r = await importiere(neu);
    expect(r.aenderungen.map(a => a.path).sort()).toEqual(['darlehen.0.betrag', 'gruender.0.privat.0.werte.0']);
    expect(r.plan.darlehen[0].betrag).toBe(30000);
  });
  it('fremde Datei wird abgelehnt', async () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('x');
    await expect(importiere((await wb.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow(/nicht mit dem ThEx/);
  });
});
