import ExcelJS from 'exceljs';
import type { Plan } from '../model/types';
import { berechne, jahr, sum, kontoAnalyse, privatKostenMonat, stundensatz, sollIstZeilen, type Ergebnis } from '../calc/plan';
import { getPath, setPath, migriere } from './storage';
import { ergebnisStatus } from '../model/schritte';
import { mdAktiv, gzAktiv, zweckTitel, zweckKurz, zweckGewaehlt } from '../model/zweck';

export const FORMAT_ID = 'THEX-FINANZPLAN';
import { APP_VERSION } from '../version';
export { APP_VERSION };

type Typ = 'n' | 's' | 'b' | 'e';
interface MapZeile { sheet: string; addr: string; path: string; typ: Typ; label: string }

const EUR = '#,##0.00 "€";[Red]-#,##0.00 "€"';
const EUR0 = '#,##0 "€";[Red]-#,##0 "€"';
const PCT = '0.0%';
const GELB = 'FFFFF4C2', BLAU = 'FF154C79', HELL = 'FFEAF1F8', GRAU = 'FFF3F4F6';
const RF_TEXT: Record<string, string> = { EU: 'Einzelunternehmen (gewerblich)', FREI: 'Freiberufler', GBR: 'GbR / Personengesellschaft', KAPG: 'Kapitalgesellschaft (UG/GmbH)' };

async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Spaltenlayout für Zeitreihen: 12 Monate, Jahr 1, Q1–Q4 + Jahr 2, Q1–Q4 + Jahr 3 */
function perioden(labels: string[]) {
  return [...labels.slice(0, 12), 'Jahr 1', 'J2 Q1', 'J2 Q2', 'J2 Q3', 'J2 Q4', 'Jahr 2', 'J3 Q1', 'J3 Q2', 'J3 Q3', 'J3 Q4', 'Jahr 3'];
}
function periodWerte(a: number[]) {
  const q = (s: number) => sum(a, s, s + 3);
  return [...a.slice(0, 12), jahr(a, 1), q(12), q(15), q(18), q(21), jahr(a, 2), q(24), q(27), q(30), q(33), jahr(a, 3)];
}

class Book {
  wb = new ExcelJS.Workbook();
  map: MapZeile[] = [];
  constructor(public plan: Plan) { this.wb.creator = 'ThEx Finanzplan'; this.wb.created = new Date(); }
  sheet(name: string, breite = [34, 16, 16, 16]) {
    const ws = this.wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 0 }] });
    breite.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    return ws;
  }
  titel(ws: ExcelJS.Worksheet, text: string, sub?: string) {
    const c = ws.getCell('A1'); c.value = text; c.font = { bold: true, size: 15, color: { argb: BLAU } };
    if (sub) { const s = ws.getCell('A2'); s.value = sub; s.font = { italic: true, color: { argb: 'FF666666' } }; }
  }
  kopf(ws: ExcelJS.Worksheet, row: number, werte: (string | number)[], start = 1) {
    werte.forEach((w, i) => { const c = ws.getCell(row, start + i); c.value = w; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }; c.alignment = { horizontal: i === 0 && start === 1 ? 'left' : 'center' }; });
  }
  wert(ws: ExcelJS.Worksheet, row: number, col: number, v: any, fmt?: string, bold = false) {
    const c = ws.getCell(row, col); c.value = typeof v === 'number' && !isFinite(v) ? null : v; if (fmt) c.numFmt = fmt; if (bold) c.font = { bold: true }; return c;
  }
  /** Eingabezelle: gelb, entsperrt, im Mapping für den Re-Import */
  input(ws: ExcelJS.Worksheet, row: number, col: number, path: string, typ: Typ, label: string, fmt?: string, liste?: string[]) {
    const raw = getPath(this.plan, path);
    const c = ws.getCell(row, col);
    c.value = typ === 'b' ? (raw ? 'ja' : 'nein') : raw ?? (typ === 'n' ? 0 : '');
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GELB } };
    c.protection = { locked: false };
    c.border = { bottom: { style: 'hair', color: { argb: 'FFCCAA00' } } };
    if (fmt) c.numFmt = fmt;
    const l = typ === 'b' ? ['ja', 'nein'] : liste;
    if (l) c.dataValidation = { type: 'list', allowBlank: false, formulae: [`"${l.join(',')}"`] };
    else if (typ === 'n') c.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [-1e12], showErrorMessage: true, errorTitle: 'Zahl erwartet', error: 'Bitte eine Zahl eingeben.' };
    this.map.push({ sheet: ws.name, addr: c.address, path, typ, label });
    return c;
  }
  zeitreihe(ws: ExcelJS.Worksheet, row: number, label: string, a: number[], bold = false, fmt = EUR0) {
    this.wert(ws, row, 1, label, undefined, bold);
    periodWerte(a).forEach((v, i) => { const c = this.wert(ws, row, 2 + i, v, fmt, bold); if ([12, 17, 22].includes(i)) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HELL } }; });
  }
  schuetzen(ws: ExcelJS.Worksheet) {
    ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true });
  }
}

export async function exportiere(plan: Plan): Promise<{ blob: Blob; dateiname: string; buffer: ArrayBuffer }> {
  const e = berechne(plan);
  const b = new Book(plan);
  const kapg = plan.einstellungen.rechtsform === 'KAPG';
  const pz = (path: string) => path; // Lesbarkeit
  const md = mdAktiv(plan), gz = gzAktiv(plan);

  // ---------- 1 Dashboard ----------
  const d = b.sheet('Dashboard', [38, 18, 18, 18, 4, 30, 18]);
  b.titel(d, `${zweckTitel(plan)}: ${plan.projekt.name || '(ohne Namen)'}`, `Planzweck: ${zweckKurz(plan)} · ${RF_TEXT[plan.einstellungen.rechtsform]} · Gründung ${plan.projekt.gruendungsmonat} · Export ${new Date().toLocaleString('de-DE')} · ThEx Finanzplan ${APP_VERSION}`);
  b.kopf(d, 4, ['Kennzahl', 'Jahr 1', 'Jahr 2', 'Jahr 3']);
  const kz: [string, keyof Ergebnis['jahre'][0]][] = [['Umsatz (netto)', 'umsatz'], ['Betriebsergebnis', 'betriebsergebnis'], ['Ergebnis vor Steuern', 'ergebnisVorSteuern'], [kapg ? 'GewSt + KSt' : 'Gewerbesteuer', 'betrieblicheSteuern'], ['Ergebnis nach betrieblichen Steuern', 'ergebnisNachSteuern']];
  kz.forEach(([l, k], i) => { b.wert(d, 5 + i, 1, l); e.jahre.forEach((j, ji) => b.wert(d, 5 + i, 2 + ji, j[k] as number, EUR0)); });
  let r = 11;
  b.kopf(d, r, ['Liquidität und Finanzierung', '']); r++;
  const lz: [string, any, string?][] = [
    ['Kapitalbedarf (netto)', e.kapitalbedarf.summe, EUR0], ['Finanzierung (Darlehen + Eigenmittel)', e.finanzierung, EUR0],
    ['Tiefster Liquiditätsstand', e.liq.tiefpunkt, EUR0], ['… im Monat', e.labels[e.liq.tiefpunktIdx]], ['Liquidität Ende Jahr 3', e.liq.kumuliert[35], EUR0],
    ['Ø Privatentnahme Jahr 1 / Monat', jahr(e.privatentnahme, 1) / 12, EUR0],
  ];
  lz.forEach(([l, v, f]) => { b.wert(d, r, 1, l); b.wert(d, r, 2, v, f); r++; });
  const est = ergebnisStatus(plan);
  const stZeile = md ? 13 : 5;
  const kd = e.kd;
  if (md) {
    // KD-Block rechts (nur mit Planzweck Mikrodarlehen)
    b.kopf(d, 4, ['Kapitaldienstfähigkeit (Plan-Jahr 2)', ''], 6);
    const kdz: [string, any, string?][] = [['KD-Grenze', kd.grenze, EUR0], ['Kapitaldienst Darlehen 1', kd.kapitaldienst, EUR0], ['Auslastung', isFinite(kd.auslastung) ? kd.auslastung : 'n. def.', PCT], ['Grenzwert', plan.params.kdGrenze, PCT], ['Max. tragbarer Darlehensbetrag', kd.maxDarlehen, EUR0]];
    kdz.forEach(([l, v, f], i) => { b.wert(d, 5 + i, 6, l); b.wert(d, 5 + i, 7, v, f); });
    const amp = d.getCell(11, 6); d.mergeCells(11, 6, 12, 7);
    amp.value = kd.ampel === 'gruen' ? 'KD GEGEBEN' : kd.ampel === 'gelb' ? 'KD GEGEBEN (KNAPP)' : 'KD NICHT GEGEBEN';
    amp.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; amp.alignment = { horizontal: 'center', vertical: 'middle' };
    amp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kd.ampel === 'gruen' ? 'FF2E7D32' : kd.ampel === 'gelb' ? 'FFF9A825' : 'FFC62828' } };
  } else {
    b.kopf(d, 4, ['Status', ''], 6);
  }
  const stc = d.getCell(stZeile, 6); d.mergeCells(stZeile, 6, stZeile, 7);
  stc.value = est.fehler.length ? `NICHT EINREICHUNGSFÄHIG · Ergebnis ${est.text}` : `Ergebnis ${est.text}`; stc.font = { bold: true, color: { argb: est.fehler.length ? 'FFC62828' : est.status === 'bestaetigt' ? 'FF2E7D32' : 'FF8A5300' } };
  if (gz) { const c = d.getCell(stZeile + 2, 6); c.value = 'Gründungszuschuss: Kapitalbedarfsplan (Blatt Investitionen_Kapitalbedarf), Rentabilitätsvorschau (Rentabilitaet), Liquiditätsplan 3 Jahre (Liquiditaet)'; c.alignment = { wrapText: true, vertical: 'top' }; d.mergeCells(stZeile + 2, 6, stZeile + 4, 7); }
  r += 1; b.kopf(d, r, ['Hinweise / Warnungen', '']); r++;
  est.gruende.forEach(g => { const c = b.wert(d, r++, 1, `• Bitte prüfen: ${g}`); c.font = { color: { argb: 'FF8A5300' } }; });
  if (!e.warnungen.length) { b.wert(d, r++, 1, 'Keine Warnungen.'); }
  [...e.warnungen.filter(w => w.fehler), ...e.warnungen.filter(w => !w.fehler)].forEach(w => { const c = b.wert(d, r++, 1, `• ${w.fehler ? 'FEHLER: ' : w.plausi ? 'Plausibilität: ' : ''}${w.text}`); c.font = { bold: !!w.fehler, color: { argb: w.schwer ? 'FFC62828' : 'FF8A6D00' } }; });
  r += 1; b.kopf(d, r, ['Inhalt dieser Datei', '']); r++;
  ['Gelbe Zellen = Eingaben (können in Excel geändert und wieder importiert werden)', 'Alle anderen Werte berechnet die App; Blätter sind ohne Passwort geschützt.', 'Re-Import: in der App „Excel importieren“ wählen – Änderungen werden zur Bestätigung angezeigt.']
    .forEach(t => b.wert(d, r++, 1, t));
  b.schuetzen(d);

  // ---------- 2 Projekt ----------
  const pj = b.sheet('Projekt', [42, 34]);
  b.titel(pj, 'Projektdaten und Einstellungen');
  const projektFelder: [string, string, Typ, string?, string[]?][] = [
    ['Projekt / Firmenname', 'projekt.name', 's'], ['Vorhaben', 'projekt.vorhaben', 's'], ['Anschrift', 'projekt.anschrift', 's'], ['Telefon', 'projekt.telefon', 's'], ['E-Mail', 'projekt.email', 's'],
    ['Branche', 'projekt.branche', 's'], ['Gemeinde', 'projekt.gemeinde', 's'], ['Gründungsmonat (JJJJ-MM)', 'projekt.gruendungsmonat', 's'],
    ['Rechtsform (EU/FREI/GBR/KAPG)', 'einstellungen.rechtsform', 'e', undefined, ['EU', 'FREI', 'GBR', 'KAPG']], ['Kleinunternehmer', 'einstellungen.kleinunternehmer', 'b'], ...(md ? [['Folgedarlehen', 'einstellungen.folgedarlehen', 'b']] as [string, string, Typ][] : []),
    ['Planzweck: Erste Schätzung / Orientierung', 'zweck.orientierung', 'b'], ['Planzweck: Gründungszuschuss (Agentur für Arbeit)', 'zweck.gz', 'b'], ['Planzweck: Thüringer Mikrodarlehen (TAB)', 'zweck.md', 'b'],
  ];
  projektFelder.forEach(([l, path, t, f, li], i) => { b.wert(pj, 3 + i, 1, l); b.input(pj, 3 + i, 2, path, t, l, f, li); });
  r = 4 + projektFelder.length;
  b.kopf(pj, r++, ['Zentrale Parameter (' + plan.params.jahr + ')', 'Wert']);
  const par: [string, keyof Plan['params'], string][] = [
    ['Gewerbesteuer-Hebesatz (4,7 = 470 %)', 'hebesatz', '0.00'], ['KV allgemeiner Satz', 'kvSatz', PCT], ['KV Zusatzbeitrag (pauschal)', 'kvZusatz', '0.00%'], ['KV Krankengeld', 'kvKrankengeld', '0.00%'],
    ['PV kinderlos', 'pvKinderlos', '0.00%'], ['PV mit Kind', 'pvKind', '0.00%'], ['KV Mindestbemessung / Monat', 'kvMindestBemessungMonat', EUR], ['BBG KV/PV p. a.', 'kvBbg', EUR0],
    ['GRV Satz', 'grvSatz', PCT], ['BBG GRV p. a.', 'grvBbg', EUR0], ['GRV Regelbeitrag / Monat', 'grvRegelbeitrag', EUR], ['AG-Anteil SV-pflichtig', 'agSv', PCT], ['AG-Anteil Minijob', 'agMinijob', PCT],
    ...(md ? [['KD-Grenzwert', 'kdGrenze', PCT], ['KD gelbe Zone ab', 'kdGelb', PCT]] as [string, keyof Plan['params'], string][] : []),
  ];
  par.forEach(([l, k, f]) => { b.wert(pj, r, 1, l); b.input(pj, r, 2, `params.${k}`, 'n', l, f); r++; });
  b.schuetzen(pj);

  // ---------- 3 Privat ----------
  const pv = b.sheet('Privat', [40, 15, 15, 15, 4, 30, 15, 15, 15]);
  b.titel(pv, 'Private Kosten und Abgaben', 'Monatsbeträge je Planjahr. KV/PV, Rente und ESt werden berechnet.');
  r = 4;
  plan.gruender.forEach((g, gi) => {
    b.kopf(pv, r, [g.name, 'Jahr 1 / Monat', 'Jahr 2 / Monat', 'Jahr 3 / Monat']); r++;
    b.wert(pv, r, 1, 'Name'); b.input(pv, r, 2, `gruender.${gi}.name`, 's', 'Name'); r++;
    g.privat.forEach((pp, pi) => {
      b.wert(pv, r, 1, `${pp.gruppe}: ${pp.bez}`);
      [0, 1, 2].forEach(j => b.input(pv, r, 2 + j, `gruender.${gi}.privat.${pi}.werte.${j}`, 'n', `${g.name} ${pp.bez} J${j + 1}`, EUR));
      r++;
    });
    b.wert(pv, r, 1, 'Summe private Kosten / Monat', undefined, true); [0, 1, 2].forEach(j => b.wert(pv, r, 2 + j, privatKostenMonat(g, j), EUR, true)); r++;
    b.wert(pv, r, 1, 'Private Einnahmen (Partner, sonstige) / Monat'); [0, 1, 2].forEach(j => b.input(pv, r, 2 + j, `gruender.${gi}.einnahmen.${j}`, 'n', `${g.name} Einnahmen J${j + 1}`, EUR)); r++;
    const einst: [string, string, Typ, string?, string[]?][] = [
      ['Gründungszuschuss / Einstiegsgeld je Monat', `gruender.${gi}.gzBetrag`, 'n', EUR], ['… von Planmonat', `gruender.${gi}.gzVon`, 'n'], ['… bis Planmonat', `gruender.${gi}.gzBis`, 'n'],
      ['Krankenversicherung (gesetzlich/privat)', `gruender.${gi}.kv`, 'e', undefined, ['gesetzlich', 'privat']], ['PKV-Beitrag / Monat', `gruender.${gi}.kvPrivatMonat`, 'n', EUR], ['PV mit Kind', `gruender.${gi}.pvKind`, 'b'],
      ['Rentenversicherung (nein/einkommen/regel/halb)', `gruender.${gi}.grv`, 'e', undefined, ['nein', 'einkommen', 'regel', 'halb']], ['Kirchensteuer', `gruender.${gi}.kirche`, 'b'],
    ];
    if (plan.einstellungen.rechtsform === 'GBR') einst.unshift(['Gewinnanteil (%)', `gruender.${gi}.anteil`, 'n']);
    if (kapg) einst.push(['GF SV-pflichtig', `gruender.${gi}.gfSvPflichtig`, 'b']);
    einst.forEach(([l, path, t, f, li]) => { b.wert(pv, r, 1, l); b.input(pv, r, 2, path, t, `${g.name} ${l}`, f, li); r++; });
    if (kapg) {
      b.wert(pv, r, 1, 'GF-Gehalt brutto / Monat'); [0, 1, 2].forEach(j => b.input(pv, r, 2 + j, `gruender.${gi}.gfGehalt.${j}`, 'n', `${g.name} GF-Gehalt J${j + 1}`, EUR)); r++;
      b.wert(pv, r, 1, 'Ausschüttung p. a.'); [0, 1, 2].forEach(j => b.input(pv, r, 2 + j, `gruender.${gi}.ausschuettung.${j}`, 'n', `${g.name} Ausschüttung J${j + 1}`, EUR)); r++;
    }
    // berechnet
    const pr = e.privat[gi];
    b.wert(pv, r, 1, 'Privatbedarf inkl. SV und ESt / Monat (Ø)', undefined, true); [1, 2, 3].forEach(j => b.wert(pv, r, 1 + j, jahr(pr.bedarf, j) / 12, EUR, true)); r++;
    b.wert(pv, r, 1, 'Privatentnahme / Jahr'); [1, 2, 3].forEach(j => b.wert(pv, r, 1 + j, jahr(pr.entnahme, j), EUR0)); r += 2;
  });
  b.schuetzen(pv);

  // ---------- 4 Umsatz ----------
  const us = b.sheet('Umsatz', [30, ...Array(24).fill(11)]);
  b.titel(us, 'Umsatzplanung', 'Preis netto × Menge × Faktor, Monat 1–24. Jahr 3 = Jahr 2 × (1 + Wachstum).');
  r = 4;
  b.wert(us, r, 1, 'Wachstum Umsatz Jahr 3 (p. a.)'); b.input(us, r, 2, 'umsatz.wachstumJ3', 'n', 'Wachstum J3', PCT); r += 2;
  b.kopf(us, r, ['Monat', ...e.labels.slice(0, 24)]); r++;
  b.wert(us, r, 1, 'Anlauf-/Saisonfaktor'); for (let m = 0; m < 24; m++) b.input(us, r, 2 + m, `umsatz.faktor.${m}`, 'n', `Faktor M${m + 1}`, '0%'); r += 2;
  plan.umsatz.felder.forEach((f, fi) => {
    b.wert(us, r, 1, 'Geschäftsfeld', undefined, true); b.input(us, r, 2, `umsatz.felder.${fi}.name`, 's', `GF${fi + 1} Name`); us.mergeCells(r, 2, r, 4);
    b.wert(us, r, 5, 'USt'); b.input(us, r, 6, `umsatz.felder.${fi}.ust`, 'n', `GF${fi + 1} USt`, '0%'); b.wert(us, r, 7, 'Materialquote'); b.input(us, r, 8, `umsatz.felder.${fi}.materialQuote`, 'n', `GF${fi + 1} Materialquote`, '0%'); r++;
    b.wert(us, r, 1, 'Preis netto'); for (let m = 0; m < 24; m++) b.input(us, r, 2 + m, `umsatz.felder.${fi}.preis.${m}`, 'n', `GF${fi + 1} Preis M${m + 1}`, '#,##0.00'); r++;
    b.wert(us, r, 1, 'Menge'); for (let m = 0; m < 24; m++) b.input(us, r, 2 + m, `umsatz.felder.${fi}.menge.${m}`, 'n', `GF${fi + 1} Menge M${m + 1}`, '#,##0.##'); r++;
    b.wert(us, r, 1, 'Umsatz netto', undefined, true); for (let m = 0; m < 24; m++) b.wert(us, r, 2 + m, e.umsatzGF[fi][m], EUR0, true); r += 2;
  });
  b.kopf(us, r, ['Übersicht', ...perioden(e.labels)]); r++;
  plan.umsatz.felder.forEach((f, fi) => b.zeitreihe(us, r++, f.name || `GF ${fi + 1}`, e.umsatzGF[fi]));
  b.zeitreihe(us, r++, 'Umsatz gesamt', e.umsatz, true);
  b.schuetzen(us);

  // ---------- 5 Personal ----------
  const pe = b.sheet('Personal', [32, 16, 16, 12, 12, 16]);
  b.titel(pe, 'Personalplanung', 'Arbeitgeberkosten = Brutto × (1 + AG-Anteil).');
  b.kopf(pe, 4, ['Stelle', 'Art (sv/minijob)', 'Brutto / Monat', 'von Monat', 'bis Monat', 'AG-Kosten J1']);
  plan.personal.forEach((s, i) => {
    const rr = 5 + i;
    b.input(pe, rr, 1, `personal.${i}.bez`, 's', `Stelle ${i + 1}`); b.input(pe, rr, 2, `personal.${i}.art`, 'e', `Stelle ${i + 1} Art`, undefined, ['sv', 'minijob']);
    b.input(pe, rr, 3, `personal.${i}.brutto`, 'n', `Stelle ${i + 1} Brutto`, EUR); b.input(pe, rr, 4, `personal.${i}.von`, 'n', `Stelle ${i + 1} von`); b.input(pe, rr, 5, `personal.${i}.bis`, 'n', `Stelle ${i + 1} bis`);
  });
  r = 6 + plan.personal.length;
  b.kopf(pe, r, ['Personalaufwand', ...perioden(e.labels)]); r++;
  b.zeitreihe(pe, r, 'Personalaufwand gesamt', e.personal, true);
  b.schuetzen(pe);

  // ---------- 6 Investitionen / Kapitalbedarf ----------
  const iv = b.sheet('Investitionen_Kapitalbedarf', [34, 14, 9, 11, 13, 9]);
  b.titel(iv, gz ? 'Kapitalbedarfsplan: Investitionen, einmalige Betriebs- und Gründungskosten' : 'Kapitalbedarf: Investitionen, einmalige Betriebs- und Gründungskosten');
  r = 4;
  b.kopf(iv, r++, ['Investition (AHK)', 'Netto', 'USt', 'Monat', 'ND (Jahre)', 'GWG']);
  plan.invest.forEach((x, i) => { b.input(iv, r, 1, `invest.${i}.bez`, 's', `Invest ${i + 1}`); b.input(iv, r, 2, `invest.${i}.netto`, 'n', `Invest ${i + 1} netto`, EUR); b.input(iv, r, 3, `invest.${i}.ust`, 'n', `Invest ${i + 1} USt`, '0%'); b.input(iv, r, 4, `invest.${i}.monat`, 'n', `Invest ${i + 1} Monat`); b.input(iv, r, 5, `invest.${i}.ndJahre`, 'n', `Invest ${i + 1} ND`); b.input(iv, r, 6, `invest.${i}.gwg`, 'b', `Invest ${i + 1} GWG`); r++; });
  r++;
  for (const [titel, key] of [['Einmalige Betriebskosten', 'betriebskosten'], ['Gründungskosten', 'gruendungskosten']] as const) {
    b.kopf(iv, r++, [titel, 'Netto', 'USt', 'Monat']);
    (plan[key] as any[]).forEach((x, i) => { b.input(iv, r, 1, `${key}.${i}.bez`, 's', `${titel} ${i + 1}`); b.input(iv, r, 2, `${key}.${i}.netto`, 'n', `${titel} ${i + 1} netto`, EUR); b.input(iv, r, 3, `${key}.${i}.ust`, 'n', `${titel} ${i + 1} USt`, '0%'); b.input(iv, r, 4, `${key}.${i}.monat`, 'n', `${titel} ${i + 1} Monat`); r++; });
    r++;
  }
  const kb = e.kapitalbedarf;
  [['Summe Investitionen', kb.invest], ['Summe Betriebskosten', kb.betriebskosten], ['Summe Gründungskosten', kb.gruendungskosten], ['Kapitalbedarf netto', kb.summe], ['zzgl. USt (Vorfinanzierung)', kb.ustSumme], ['Finanzierung gesamt', e.finanzierung]]
    .forEach(([l, v]) => { b.wert(iv, r, 1, l as string, undefined, l === 'Kapitalbedarf netto'); b.wert(iv, r, 2, v as number, EUR0, l === 'Kapitalbedarf netto'); r++; });
  r++; b.kopf(iv, r++, ['Abschreibungen', ...perioden(e.labels)]); b.zeitreihe(iv, r, 'AfA', e.afa, true);
  b.schuetzen(iv);

  // ---------- 7 Kosten ----------
  const ko = b.sheet('Kosten', [36, 9, ...Array(12).fill(11), 13, 13, 13]);
  b.titel(ko, 'Sonstige betriebliche Kosten', 'Eingabe nur Jahr 1 (monatlich); Jahr 2 und 3 werden mit den Steigerungsraten berechnet.');
  b.wert(ko, 3, 1, 'Kostensteigerung Jahr 2'); b.input(ko, 3, 2, 'kosten.steigerungJ2', 'n', 'Steigerung J2', PCT);
  b.wert(ko, 4, 1, 'Kostensteigerung Jahr 3'); b.input(ko, 4, 2, 'kosten.steigerungJ3', 'n', 'Steigerung J3', PCT);
  r = 6; b.kopf(ko, r++, ['Position', 'USt', ...e.labels.slice(0, 12), 'Jahr 1', 'Jahr 2', 'Jahr 3']);
  plan.kosten.posten.forEach((k, i) => {
    b.input(ko, r, 1, `kosten.posten.${i}.bez`, 's', `Kosten ${i + 1}`); b.input(ko, r, 2, `kosten.posten.${i}.ust`, 'n', `Kosten ${i + 1} USt`, '0%');
    for (let m = 0; m < 12; m++) b.input(ko, r, 3 + m, `kosten.posten.${i}.monate.${m}`, 'n', `${k.bez} M${m + 1}`, '#,##0.00');
    const j1 = sum(k.monate), j2 = j1 * (1 + plan.kosten.steigerungJ2), j3 = j2 * (1 + plan.kosten.steigerungJ3);
    [j1, j2, j3].forEach((v, x) => b.wert(ko, r, 15 + x, v, EUR0, true)); r++;
  });
  r++;
  for (const [titel, key] of [['Zuschüsse / sonstige Erträge', 'zuschuesse'], ['Außerordentliche Erträge', 'aoErtrag'], ['Außerordentliche Aufwendungen', 'aoAufwand']] as const) {
    b.kopf(ko, r++, [titel, '', 'Betrag/Monat', 'von', 'bis']);
    plan.kosten[key].forEach((z, i) => { b.input(ko, r, 1, `kosten.${key}.${i}.bez`, 's', `${titel} ${i + 1}`); b.input(ko, r, 3, `kosten.${key}.${i}.betrag`, 'n', `${titel} ${i + 1} Betrag`, EUR); b.input(ko, r, 4, `kosten.${key}.${i}.von`, 'n', `${titel} ${i + 1} von`); b.input(ko, r, 5, `kosten.${key}.${i}.bis`, 'n', `${titel} ${i + 1} bis`); r++; });
    r++;
  }
  b.schuetzen(ko);

  // ---------- 8 Darlehen ----------
  const dl = b.sheet('Darlehen', [30, 14, 14, 14, 14, 14, 14]);
  b.titel(dl, gz && !md ? 'Finanzierung (Kapitalbedarfsplan)' : 'Darlehen und Finanzierung', md ? 'Darlehen 1 = Mikrodarlehen (KD-relevant). Tilgungsdarlehen: konstante Tilgung; Annuität: konstante Rate.' : 'Ohne Planzweck Mikrodarlehen: Darlehen 1 (Mikrodarlehen) ist ausgeblendet und wird nicht gerechnet. Tilgungsdarlehen: konstante Tilgung; Annuität: konstante Rate.');
  const dIdx = plan.darlehen.map((_, i) => i).filter(i => md || i > 0);
  r = 4;
  const dfelder: [string, string, Typ, string?, string[]?][] = [['Bezeichnung', 'bez', 's'], ['Betrag', 'betrag', 'n', EUR0], ['Laufzeit (Monate, inkl. tilgungsfrei)', 'laufzeit', 'n'], ['Tilgungsfreie Monate', 'tilgungsfrei', 'n'], ['Sollzins p. a.', 'sollzins', 'n', '0.00%'], ['Effektivzins p. a. (Info)', 'effzins', 'n', '0.00%'], ['Auszahlung im Planmonat', 'auszahlungMonat', 'n'], ['Art (tilgung/annuitaet)', 'art', 'e', undefined, ['tilgung', 'annuitaet']], ['Bestehender Kredit', 'bestehend', 'b']];
  if (dIdx.length) {
    b.kopf(dl, r++, ['Konditionen', ...dIdx.map(i => `Darlehen ${i + 1}`)]);
    dfelder.forEach(([l, k, t, f, li]) => { b.wert(dl, r, 1, l); dIdx.forEach((i, c) => b.input(dl, r, 2 + c, `darlehen.${i}.${k}`, t, `Darlehen ${i + 1} ${l}`, f, li)); r++; });
  } else { b.wert(dl, r++, 1, 'Keine Darlehen geplant.'); }
  r++;
  b.kopf(dl, r++, ['Eigenmittel', 'Betrag', 'Planmonat']);
  ([['Barmittel / Einlage', 'bar', 'barMonat'], ['Privatdarlehen', 'privatdarlehen', 'privatdarlehenMonat'], ['Sachmittelzuschuss (z. B. Jobcenter)', 'sachzuschuss', 'sachzuschussMonat']] as const)
    .forEach(([l, k, km]) => { b.wert(dl, r, 1, l); b.input(dl, r, 2, `eigenmittel.${k}`, 'n', l, EUR0); b.input(dl, r, 3, `eigenmittel.${km}`, 'n', `${l} Monat`); r++; });
  b.wert(dl, r, 1, 'Sacheinlagen (Wert, nicht liquiditätswirksam)'); b.input(dl, r, 2, 'eigenmittel.sacheinlage', 'n', 'Sacheinlage', EUR0); r += 2;
  e.darlehen.forEach((x, i) => {
    if (!x.plan.length || (i === 0 && !md)) return;
    b.kopf(dl, r++, [`Tilgungsplan Darlehen ${i + 1}: ${x.d.bez}`, 'Planmonat', 'Restschuld Anfang', 'Zins', 'Tilgung', 'Rate', 'Restschuld Ende']);
    x.plan.forEach(z => { b.wert(dl, r, 1, `Darlehensmonat ${z.k}`); b.wert(dl, r, 2, z.planMonat); [z.restAnfang, z.zins, z.tilgung, z.rate, z.restEnde].forEach((v, c) => b.wert(dl, r, 3 + c, v, EUR)); r++; });
    r++;
  });
  b.schuetzen(dl);

  // ---------- 9 Rentabilität ----------
  const rv = b.sheet('Rentabilitaet', [36, ...Array(23).fill(12)]);
  b.titel(rv, gz ? 'Rentabilitätsvorschau (3 Jahre)' : 'Rentabilitätsvorschau', 'Jahr 1 monatlich, Jahr 2 und 3 quartalsweise (netto).');
  b.kopf(rv, 4, ['Position', ...perioden(e.labels)]);
  r = 5;
  const neg = (a: number[]) => a.map(x => -x);
  ([['Umsatzerlöse', e.umsatz], ['+ Zuschüsse / sonst. Erträge', e.zuschuesse], ['= Betriebsertrag', e.betriebsertrag, true], ['− Material / Fremdleistung', neg(e.material)], ['− Personal', neg(e.personal)],
    ['− Abschreibungen', neg(e.afa)], ['− Zinsen', neg(e.zinsen)], ['− Sonstige Kosten', neg(e.kosten)], ['− Einmalige Betriebs-/Gründungskosten', neg(e.einmal)], ['= Betriebsergebnis', e.betriebsergebnis, true],
    ['+ a.o. Erträge', e.aoErtrag], ['− a.o. Aufwand', neg(e.aoAufwand)], ['= Ergebnis vor Steuern', e.ergebnisVorSteuern, true]] as [string, number[], boolean?][])
    .forEach(([l, a, bo]) => b.zeitreihe(rv, r++, l, a, !!bo));
  r++;
  b.kopf(rv, r++, ['Jahresübersicht', 'Jahr 1', 'Jahr 2', 'Jahr 3']);
  ([['Ergebnis vor Steuern', 'ergebnisVorSteuern'], [kapg ? '− GewSt und KSt' : '− Gewerbesteuer', 'betrieblicheSteuern'], ['= Ergebnis nach betrieblichen Steuern', 'ergebnisNachSteuern']] as const)
    .forEach(([l, k]) => { b.wert(rv, r, 1, l); e.jahre.forEach((j, ji) => b.wert(rv, r, 2 + ji, (k === 'betrieblicheSteuern' ? -1 : 1) * (j[k] as number), EUR0)); r++; });
  b.wert(rv, r, 1, 'Umsatzrentabilität'); e.jahre.forEach((j, ji) => b.wert(rv, r, 2 + ji, j.umsatz ? j.ergebnisVorSteuern / j.umsatz : null, PCT));
  b.schuetzen(rv);

  // ---------- 10 Liquidität ----------
  const lq = b.sheet('Liquiditaet', [40, ...Array(23).fill(12)]);
  b.titel(lq, gz ? 'Liquiditätsplan 3 Jahre (brutto)' : 'Liquiditätsplan (brutto)');
  b.kopf(lq, 4, ['Position', ...perioden(e.labels)]);
  r = 5;
  const L = e.liq;
  ([['Umsatz brutto', L.einz.umsatzBrutto], ['Zuschüsse', L.einz.zuschuesse], ['a.o. Erträge', L.einz.aoErtrag], ['USt-Erstattung', L.einz.ustErstattung], ['Darlehensauszahlungen', L.einz.darlehen], ['Barmittel / Einlage', L.einz.bar], ['Privatdarlehen', L.einz.privatdarlehen], ['Sachmittelzuschuss', L.einz.sachzuschuss], ['Summe Einzahlungen', L.summeEin, true],
    ['Material brutto', L.ausz.material], ['Personal', L.ausz.personal], ['Sonstige Kosten brutto', L.ausz.kosten], ['Einmalige Kosten brutto', L.ausz.einmal], ['Investitionen brutto', L.ausz.invest], ['Kaution', L.ausz.kaution], ['USt-Zahlung', L.ausz.ust], ['Zinsen', L.ausz.zinsen], ['Tilgung', L.ausz.tilgung], [kapg ? 'GewSt/KSt' : 'Gewerbesteuer', L.ausz.steuern], ['a.o. Aufwand', L.ausz.aoAufwand],
    [kapg ? 'Ausschüttungen' : 'Privatentnahmen (inkl. SV/ESt)', kapg ? L.ausz.ausschuettung : L.ausz.privatentnahme], ['Summe Auszahlungen', L.summeAus, true], ['Saldo', L.saldo, true], ['Liquidität kumuliert', L.kumuliert, true], ['Liquidität kumuliert ohne Gründungszuschuss', L.kumuliertOhneGZ]] as [string, number[], boolean?][])
    .forEach(([l, a, bo]) => b.zeitreihe(lq, r++, l, a, !!bo));
  // Kumulierte Werte sind Stände, keine Summen: Jahres-/Quartalsspalten mit Endstand überschreiben
  [r - 2, r - 1].forEach((row, i) => { const a = i === 0 ? L.kumuliert : L.kumuliertOhneGZ; const ende = (m: number) => a[m - 1]; [[14, 12], [15, 15], [16, 18], [17, 21], [18, 24], [19, 24], [20, 27], [21, 30], [22, 33], [23, 36], [24, 36]].forEach(([c, m]) => (lq.getCell(row, c).value = ende(m))); });
  lq.addConditionalFormatting({ ref: `B${r - 2}:X${r - 1}`, rules: [{ type: 'cellIs', operator: 'lessThan', formulae: [0], priority: 1, style: { font: { color: { argb: 'FFC62828' }, bold: true } } }] });
  r++;
  b.wert(lq, r, 1, 'Kaution (Betrag)'); b.input(lq, r, 2, 'liquiditaet.kaution', 'n', 'Kaution', EUR0); b.wert(lq, r, 3, 'Monat'); b.input(lq, r, 4, 'liquiditaet.kautionMonat', 'n', 'Kaution Monat'); r++;
  b.wert(lq, r, 1, 'USt-Zahlung (sofort/folgemonat/dfv/quartal)'); b.input(lq, r, 2, 'liquiditaet.ustModus', 'e', 'USt-Modus', undefined, ['sofort', 'folgemonat', 'dfv', 'quartal']);
  b.schuetzen(lq);

  // ---------- 11 USt ----------
  const ut = b.sheet('USt', [30, ...Array(23).fill(12)]);
  b.titel(ut, 'Umsatzsteuer', plan.einstellungen.kleinunternehmer ? 'Kleinunternehmer: keine USt.' : 'Zahllast > 0 = Zahlung ans Finanzamt; < 0 = Erstattung.');
  b.kopf(ut, 4, ['Position', ...perioden(e.labels)]);
  b.zeitreihe(ut, 5, 'USt auf Umsätze', e.ust.ust); b.zeitreihe(ut, 6, 'Vorsteuer', e.ust.vst); b.zeitreihe(ut, 7, 'Zahllast (Entstehung)', e.ust.zahllast, true); b.zeitreihe(ut, 8, 'Zahlung (Fälligkeit)', e.ust.zahlung, true);
  b.schuetzen(ut);

  // ---------- 12 Steuern ----------
  const sa = b.sheet('Steuern_Abgaben', [44, 16, 16, 16]);
  b.titel(sa, 'Steuern und Abgaben', kapg ? 'Kapitalgesellschaft: GewSt + KSt auf Gesellschaftsebene, ESt/SV des GF privat.' : 'Einkommensteuer-Grundtarif 2026, § 35-Anrechnung, Einzelveranlagung.');
  r = 4; b.kopf(sa, r++, ['Betrieb', 'Jahr 1', 'Jahr 2', 'Jahr 3']);
  ([['Ergebnis vor Steuern', 'ergebnis'], ['GewSt-Messbetrag', 'messbetrag'], ['Gewerbesteuer', 'gewSt'], ['Körperschaftsteuer inkl. Soli', 'kst']] as const)
    .forEach(([l, k]) => { b.wert(sa, r, 1, l); e.steuerJahre.forEach((s, i) => b.wert(sa, r, 2 + i, s[k], EUR0)); r++; });
  r++;
  plan.gruender.forEach((g, gi) => {
    b.kopf(sa, r++, [g.name, 'Jahr 1', 'Jahr 2', 'Jahr 3']);
    const rows: [string, (j: number) => number][] = kapg
      ? [['GF-Gehalt p. a.', j => e.steuerJahre[j].gf[gi]?.gehalt ?? 0], ['Sozialversicherung', j => e.steuerJahre[j].gf[gi]?.sv ?? 0], ['zvE', j => e.steuerJahre[j].gf[gi]?.zvE ?? 0], ['ESt + Soli + KiSt', j => e.steuerJahre[j].gf[gi]?.steuer ?? 0], ['Ausschüttung', j => e.steuerJahre[j].gf[gi]?.ausschuettung ?? 0], ['KapESt', j => e.steuerJahre[j].gf[gi]?.kapESt ?? 0], ['Netto verfügbar', j => e.steuerJahre[j].gf[gi]?.netto ?? 0]]
      : [['Gewinnanteil', j => e.steuerJahre[j].personen[gi]?.gewinn ?? 0], ['KV/PV', j => e.steuerJahre[j].personen[gi]?.kvpv ?? 0], ['Rentenversicherung', j => e.steuerJahre[j].personen[gi]?.grv ?? 0], ['zvE', j => e.steuerJahre[j].personen[gi]?.zvE ?? 0], ['ESt laut Tarif', j => e.steuerJahre[j].personen[gi]?.estTarif ?? 0], ['− Anrechnung GewSt (§ 35)', j => e.steuerJahre[j].personen[gi]?.anrechnung35 ?? 0], ['ESt', j => e.steuerJahre[j].personen[gi]?.est ?? 0], ['Soli + KiSt', j => (e.steuerJahre[j].personen[gi]?.soli ?? 0) + (e.steuerJahre[j].personen[gi]?.kiSt ?? 0)]];
    rows.forEach(([l, f]) => { b.wert(sa, r, 1, l); [0, 1, 2].forEach(j => b.wert(sa, r, 2 + j, f(j), EUR0)); r++; });
    r++;
  });
  b.schuetzen(sa);

  if (md) {
  // ---------- 13 KD ----------
  const kdw = b.sheet('KD_Pruefung', [62, 18]);
  b.titel(kdw, 'Kapitaldienstfähigkeit – Plan-Jahr 2 (Monate 13–24)', `Grenzwert ${(plan.params.kdGrenze * 100).toFixed(0)} % · gelbe Zone ab ${(plan.params.kdGelb * 100).toFixed(0)} %`);
  r = 4;
  const kdRows: [string, number, boolean?][] = [
    ['(1) Betriebsergebnis Plan-Jahr 2', kd.be2], ['(2) + Abschreibungen', kd.afa2], ['(3) + Zinsaufwand Darlehen 1', kd.zinsD1], ['(4) = Mittelzufluss', kd.zufluss, true],
    ...(kapg ? [['(5) − Ausschüttungen Plan-Jahr 2', -kd.ausschuettung2] as [string, number]] : kd.entnahmenDetail.flatMap(x => [[`(5) − Entnahmen ${x.name}: private Kosten × 12`, -x.privat], [`      − Sozialversicherung ${x.name}`, -x.sv], [`      − ESt/Soli/KiSt ${x.name}`, -x.est]] as [string, number][])),
    ['(6) − Gewerbesteuer', -kd.gewSt2], ...(kapg ? [['(6) − Körperschaftsteuer', -kd.kst2] as [string, number]] : []), ['(7) − Kapitaldienst weiterer / bestehender Kredite', -kd.kdAndere], ['(8) = KD-Grenze', kd.grenze, true],
    ['(9) Kapitaldienst Darlehen 1 (Zins ' + kd.zinsD1.toFixed(2) + ' € + Tilgung ' + kd.tilgD1.toFixed(2) + ' €)', kd.kapitaldienst, true],
  ];
  kdRows.forEach(([l, v, bo]) => { b.wert(kdw, r, 1, l, undefined, !!bo); b.wert(kdw, r, 2, v, EUR, !!bo); r++; });
  b.wert(kdw, r, 1, '(10) Auslastung = (9) / (8)', undefined, true); b.wert(kdw, r, 2, isFinite(kd.auslastung) ? kd.auslastung : 'nicht definiert', PCT, true); r++;
  const ac = kdw.getCell(r, 1); kdw.mergeCells(r, 1, r, 2); ac.value = kd.ampel === 'gruen' ? 'KD GEGEBEN' : kd.ampel === 'gelb' ? 'KD GEGEBEN (KNAPP)' : 'KD NICHT GEGEBEN'; ac.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kd.ampel === 'gruen' ? 'FF2E7D32' : kd.ampel === 'gelb' ? 'FFF9A825' : 'FFC62828' } }; ac.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; ac.alignment = { horizontal: 'center' }; r += 2;
  b.wert(kdw, r, 1, `Max. tragbarer Darlehensbetrag bei ${(plan.params.kdGrenze * 100).toFixed(0)} % Auslastung (gleiche Konditionen)`); b.wert(kdw, r, 2, kd.maxDarlehen, EUR0); r++;
  if (kapg) kd.tragfaehigkeit.forEach(t => { b.wert(kdw, r, 1, `Private Tragfähigkeit ${t.name}: netto verfügbar / Bedarf`); b.wert(kdw, r, 2, `${Math.round(t.netto)} € / ${Math.round(t.bedarf)} €`); r++; });
  b.schuetzen(kdw);
  }

  // ---------- optionale Blätter ----------
  if (plan.gruender.some(g => g.hb.monate.some(m => m.ein || m.ende))) {
    const hb = b.sheet('Haushaltsbuch', [24, 14, 30, 14, 14]);
    b.titel(hb, 'Haushaltsbuch (optional)');
    r = 3;
    plan.gruender.forEach((g, gi) => {
      const a = kontoAnalyse(g.hb.anfang, g.hb.monate);
      b.kopf(hb, r++, [g.name, 'Anfang', 'Einzahlungen (z. B. 100+50)', 'Endbestand', 'Auszahlungen']);
      b.wert(hb, r, 1, 'Anfangsbestand Monat 1'); b.input(hb, r, 2, `gruender.${gi}.hb.anfang`, 'n', `${g.name} HB Anfang`, EUR); r++;
      a.zeilen.forEach((z, i) => { b.wert(hb, r, 1, `Monat ${i + 1}`); b.wert(hb, r, 2, z.anfang, EUR); b.input(hb, r, 3, `gruender.${gi}.hb.monate.${i}.ein`, 's', `${g.name} HB M${i + 1} Ein`); b.input(hb, r, 4, `gruender.${gi}.hb.monate.${i}.ende`, 'n', `${g.name} HB M${i + 1} Ende`, EUR); b.wert(hb, r, 5, z.aus, EUR); r++; });
      b.wert(hb, r, 1, 'Ø Auszahlungen', undefined, true); b.wert(hb, r, 5, a.avgAus, EUR, true); r += 2;
    });
    b.schuetzen(hb);
  }
  if (plan.stundensatz.aktiv) {
    const s = stundensatz(plan, e);
    const sw = b.sheet('Stundensatz', [50, 16]);
    b.titel(sw, `Stundensatz-Kalkulation (Basis Plan-Jahr ${plan.stundensatz.jahr})`);
    r = 3;
    ([['Private Kosten p. a.', s.privatKosten, EUR0], ['+ KV/PV/RV', s.sv, EUR0], ['+ ESt, Soli, KiSt', s.est, EUR0], ['− private Einnahmen / Zuschüsse', -s.einnahmen, EUR0], ['+ Betriebliche Kosten ohne Material', s.betrieb, EUR0], ['+ Kapitaldienst', s.kapitaldienst, EUR0], ['+ Betriebliche Steuern', s.steuern, EUR0], ['+ Ausschüttungen', s.ausschuettung, EUR0], ['+ Gewinnaufschlag', s.gewinnaufschlag, EUR0], ['− Rohertrag anderer Geschäftsfelder', -s.rohertragAndere, EUR0], ['= Über Stunden zu decken', s.basis, EUR0], ['Produktive Stunden p. a.', s.produktiv, '#,##0'], ['Auslastungsquote', plan.stundensatz.auslastung, PCT], ['Fakturierbare Stunden p. a.', s.stunden, '#,##0'], ['Erforderlicher Stundensatz netto', s.satz, EUR], ['Erforderlicher Tagessatz netto', s.tagessatz, EUR], ['Geplanter Stundensatz netto', s.geplant, EUR], ['Differenz geplant − erforderlich', isFinite(s.differenz) ? s.differenz : 0, EUR]] as [string, number, string][])
      .forEach(([l, v, f]) => { b.wert(sw, r, 1, l); b.wert(sw, r, 2, v, f); r++; });
    b.schuetzen(sw);
  }
  if (md && plan.einstellungen.folgedarlehen) {
    const si = b.sheet('Soll_Ist', [36, 16, 16, 16, 12]);
    const n = plan.sollIst.monate;
    b.titel(si, `Soll-Ist-Vergleich Monate 1–${n}`);
    b.kopf(si, 3, ['Position', 'Soll', 'Ist', 'Abweichung', '%']);
    sollIstZeilen(e).forEach(([k, l, a], i) => { const soll = sum(a, 0, n); const ist = plan.sollIst.ist[k] ?? 0; b.wert(si, 4 + i, 1, l); b.wert(si, 4 + i, 2, soll, EUR0); b.input(si, 4 + i, 3, `sollIst.ist.${k}`, 'n', `Ist ${l}`, EUR0); b.wert(si, 4 + i, 4, ist - soll, EUR0); b.wert(si, 4 + i, 5, soll ? (ist - soll) / soll : null, PCT); });
    b.schuetzen(si);
  }
  if (md && (plan.meta.pruefer || plan.gruender.some(g => g.ka.monate.some(m => m.ein || m.ende)) || plan.pruefung.vermerk)) {
    const pr = b.sheet('Pruefung', [40, 14, 30, 14, 14]);
    b.titel(pr, 'Prüfung (Kreditprüfer): Kontoauszugsanalyse und Vermerk');
    r = 3;
    plan.gruender.forEach((g, gi) => {
      const a = kontoAnalyse(g.ka.anfang, g.ka.monate);
      b.kopf(pr, r++, [g.name, 'Anfang', 'Einzahlungen', 'Endbestand', 'Auszahlungen']);
      b.wert(pr, r, 1, 'Anfangsbestand'); b.input(pr, r, 2, `gruender.${gi}.ka.anfang`, 'n', `${g.name} KA Anfang`, EUR); r++;
      a.zeilen.forEach((z, i) => { b.wert(pr, r, 1, `Monat ${i + 1}`); b.wert(pr, r, 2, z.anfang, EUR); b.input(pr, r, 3, `gruender.${gi}.ka.monate.${i}.ein`, 's', `${g.name} KA M${i + 1} Ein`); b.input(pr, r, 4, `gruender.${gi}.ka.monate.${i}.ende`, 'n', `${g.name} KA M${i + 1} Ende`, EUR); b.wert(pr, r, 5, z.aus, EUR); r++; });
      const plan1 = privatKostenMonat(g, 0);
      b.wert(pr, r, 1, 'Ø Auszahlungen lt. Kontoauszug / geplante private Kosten J1'); b.wert(pr, r, 2, a.avgAus, EUR); b.wert(pr, r, 4, plan1, EUR); b.wert(pr, r, 5, plan1 ? a.avgAus / plan1 - 1 : null, PCT); r += 2;
    });
    ([['Status (offen/geprueft/nachbesserung)', 'pruefung.status', 'e', ['offen', 'geprueft', 'nachbesserung']], ['Prüfer/in', 'pruefung.pruefer', 's'], ['Datum', 'pruefung.datum', 's'], ['Vermerk', 'pruefung.vermerk', 's']] as [string, string, Typ, string[]?][])
      .forEach(([l, path, t, li]) => { b.wert(pr, r, 1, l); b.input(pr, r, 2, path, t, l, undefined, li); if (t === 's') pr.mergeCells(r, 2, r, 5); r++; });
    b.schuetzen(pr);
  }

  // ---------- _daten (veryHidden) ----------
  const json = JSON.stringify(plan);
  const hash = await sha256(json);
  const dw = b.wb.addWorksheet('_daten', { state: 'veryHidden' });
  dw.getCell('A1').value = FORMAT_ID; dw.getCell('A2').value = plan.schemaVersion; dw.getCell('A3').value = APP_VERSION;
  dw.getCell('A4').value = new Date().toISOString(); dw.getCell('A5').value = hash; dw.getCell('A6').value = plan.params.jahr;
  const CH = 30000;
  for (let i = 0, row = 10; i < json.length; i += CH, row++) dw.getCell(row, 1).value = json.slice(i, i + CH);
  dw.getCell('C1').value = 'sheet'; dw.getCell('D1').value = 'addr'; dw.getCell('E1').value = 'path'; dw.getCell('F1').value = 'typ'; dw.getCell('G1').value = 'label';
  b.map.forEach((m, i) => { const row = dw.getRow(i + 2); row.getCell(3).value = m.sheet; row.getCell(4).value = m.addr; row.getCell(5).value = m.path; row.getCell(6).value = m.typ; row.getCell(7).value = m.label; });

  const buffer = (await b.wb.xlsx.writeBuffer()) as ArrayBuffer;
  const name = (plan.projekt.name || 'Finanzplan').replace(/[^\wäöüÄÖÜß-]+/g, '_');
  return { blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), dateiname: `Finanzplan_${name}_${new Date().toISOString().slice(0, 10)}.xlsx`, buffer };
}

// ===================== Import =====================
export interface Aenderung { path: string; label: string; alt: any; neu: any }
export interface ImportErgebnis { plan: Plan; aenderungen: Aenderung[]; meta: { schemaVersion: number; appVersion: string; exportiert: string; hashOk: boolean; /** ältere Datei (v1.0–v1.2) ohne Planzweck → Mikrodarlehen voreingestellt */ zweckErgaenzt: boolean } }

function zellwert(v: any): any {
  if (v && typeof v === 'object') { if ('result' in v) return v.result; if ('richText' in v) return v.richText.map((t: any) => t.text).join(''); if ('text' in v) return v.text; }
  return v;
}

export async function importiere(data: ArrayBuffer): Promise<ImportErgebnis> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const dw = wb.getWorksheet('_daten');
  if (!dw || zellwert(dw.getCell('A1').value) !== FORMAT_ID) throw new Error('Diese Datei wurde nicht mit dem ThEx-Finanzplan exportiert (Blatt „_daten“ fehlt).');
  let json = '';
  for (let row = 10; ; row++) { const v = zellwert(dw.getCell(row, 1).value); if (!v) break; json += String(v); }
  const hashOk = (await sha256(json)) === zellwert(dw.getCell('A5').value);
  const original = JSON.parse(json);
  const plan = migriere(JSON.parse(json));
  const aenderungen: Aenderung[] = [];
  for (let row = 2; ; row++) {
    const r = dw.getRow(row);
    const sheet = zellwert(r.getCell(3).value); if (!sheet) break;
    const addr = String(zellwert(r.getCell(4).value)), path = String(zellwert(r.getCell(5).value)), typ = zellwert(r.getCell(6).value) as Typ, label = String(zellwert(r.getCell(7).value) ?? path);
    const ws = wb.getWorksheet(String(sheet)); if (!ws) continue;
    let v = zellwert(ws.getCell(addr).value);
    const alt = getPath(original, path);
    if (typ === 'n') { if (v === null || v === undefined || v === '') v = 0; if (typeof v === 'string') v = Number(v.replace(/\./g, '').replace(',', '.')); if (!isFinite(v)) continue; if (typeof alt === 'number' && Math.abs(v - alt) < 1e-9) continue; }
    else if (typ === 'b') { v = String(v ?? '').trim().toLowerCase() === 'ja'; if (v === !!alt) continue; }
    else { v = v == null ? '' : String(v); if (v === (alt ?? '')) continue; }
    try { setPath(plan, path, v); } catch { continue; }
    aenderungen.push({ path, label, alt, neu: v });
  }
  // Planzweck: mindestens einer muss gewählt bleiben – sonst bleibt der Zweck aus dem Datenblock
  if (!zweckGewaehlt(plan)) { plan.zweck = migriere(original).zweck; for (let i = aenderungen.length - 1; i >= 0; i--) if (aenderungen[i].path.startsWith('zweck.')) aenderungen.splice(i, 1); }
  else if (aenderungen.some(a => a.path.startsWith('zweck.'))) plan.meta.zweckErgaenzt = false;
  return { plan, aenderungen, meta: { schemaVersion: Number(zellwert(dw.getCell('A2').value)), appVersion: String(zellwert(dw.getCell('A3').value)), exportiert: String(zellwert(dw.getCell('A4').value)), hashOk, zweckErgaenzt: !!plan.meta.zweckErgaenzt } };
}
