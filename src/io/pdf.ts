/**
 * PDF-Zusammenfassung (v1.1; v1.3: Titel und Inhalt nach Planzweck – Mikrodarlehen/TAB, Gründungszuschuss, erste Schätzung).
 * Wird nur bei Bedarf geladen (dynamic import) und komplett im Browser erzeugt – keine Datenübertragung.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput, type CellHookData } from 'jspdf-autotable';
import type { Plan } from '../model/types';
import { berechne, jahr, stundensatz, type Ergebnis } from '../calc/plan';
import { ergebnisStatus } from '../model/schritte';
import { mdAktiv, gzAktiv, nurSchaetzung, zweckTitel, zweckKurz, zweckDateiKuerzel } from '../model/zweck';
import { APP_VERSION } from '../version';

const BLAU: [number, number, number] = [0, 82, 116];      // #005274 (thex.de)
const BLAU2: [number, number, number] = [0, 137, 193];    // #0089C1
const LIME: [number, number, number] = [201, 211, 14];    // #C9D30E
const TEXT: [number, number, number] = [31, 56, 77];      // #1f384d
const GRAU: [number, number, number] = [110, 125, 140];
const AMPEL: Record<string, [number, number, number]> = { gruen: [46, 125, 50], gelb: [249, 168, 37], rot: [198, 40, 40] };
const RF: Record<string, string> = { EU: 'Einzelunternehmen (gewerblich)', FREI: 'Freiberufler', GBR: 'GbR / Personengesellschaft', KAPG: 'Kapitalgesellschaft (UG/GmbH)' };

/** Standardschrift (WinAnsi): nicht darstellbare Zeichen ersetzen */
export const pdfText = (s: string) => s.replace(/\u2212/g, '-').replace(/[\u2009\u202f]/g, ' ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[✓↻○→]/g, m => ({ '✓': '', '↻': '', '○': '', '→': '->' } as Record<string, string>)[m]).replace(/[^\x00-\xff€„“”‚‘’–—…•ŠšŽžŒœŸ]/g, '');
const eur = (v: number, d = 0) => (isFinite(v) ? `${(Math.abs(v) < 0.5 / 10 ** d ? 0 : v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} €` : '–');
const pct = (v: number, d = 1) => (isFinite(v) ? `${(v * 100).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %` : 'n. def.');
const AMPEL_TEXT = { gruen: 'Kapitaldienstfähigkeit gegeben', gelb: 'Kapitaldienstfähigkeit gegeben, aber knapp', rot: 'Kapitaldienstfähigkeit nicht gegeben' } as const;

export interface PdfErgebnis { blob: Blob; dateiname: string; seiten: number; doc: jsPDF }

export async function erstellePdf(plan: Plan, jetzt = new Date()): Promise<PdfErgebnis> {
  const e = berechne(plan);
  const md = mdAktiv(plan), gz = gzAktiv(plan), schaetzung = nurSchaetzung(plan);
  const dokTitel = zweckTitel(plan);
  const adressat = md && gz ? 'Zusammenfassung für TAB und fachkundige Stelle' : md ? 'Zusammenfassung für die Thüringer Aufbaubank' : gz ? 'Unterlagen Gründungszuschuss (fachkundige Stelle)' : 'Erste Schätzung – zur eigenen Orientierung';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: pdfText(`${dokTitel}: ${plan.projekt.name}`), subject: pdfText(adressat), creator: `ThEx Finanzplan ${APP_VERSION}`, author: pdfText(plan.gruender.map(g => g.name).join(', ')) });
  const W = () => doc.internal.pageSize.getWidth(), H = () => doc.internal.pageSize.getHeight();
  const M = 15;
  let y = 0;
  const t = (s: string) => pdfText(s);

  const kopf = (titel: string) => {
    doc.setFillColor(...BLAU); doc.rect(0, 0, W(), 14, 'F');
    doc.setFillColor(...LIME); doc.rect(0, 14, W(), 1.2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('ThEx', M, 9.2);
    doc.setFont('helvetica', 'normal'); doc.text('Finanzplan', M + doc.getTextWidth('ThEx') + 1.5, 9.2);
    doc.setFontSize(9); doc.text(t(titel), W() - M, 9.2, { align: 'right' });
    y = 24;
  };
  const neueSeite = (titel: string, quer = false) => { doc.addPage('a4', quer ? 'landscape' : 'portrait'); kopf(titel); };
  const h2 = (s: string) => {
    if (y > H() - 40) neueSeite(plan.projekt.name || 'Finanzplan');
    doc.setTextColor(...BLAU); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(t(s), M, y);
    doc.setDrawColor(...BLAU2); doc.setLineWidth(0.4); doc.line(M, y + 1.8, M + 25, y + 1.8); y += 7;
  };
  const absatz = (s: string, size = 9, farbe = TEXT) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...farbe);
    const zeilen = doc.splitTextToSize(t(s), W() - 2 * M);
    if (y + zeilen.length * size * 0.42 > H() - 18) neueSeite(plan.projekt.name || 'Finanzplan');
    doc.text(zeilen, M, y); y += zeilen.length * size * 0.42 + 2;
  };
  const fehlerKasten = (titel: string, texte: string[], warnung = false) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const zeilen = texte.flatMap(x => doc.splitTextToSize(t('• ' + x), W() - 2 * M - 10));
    const hh = 11 + zeilen.length * 4.2;
    const rand = warnung ? AMPEL.gelb : AMPEL.rot;
    if (warnung) doc.setFillColor(255, 248, 225); else doc.setFillColor(253, 236, 234);
    doc.setDrawColor(...rand); doc.setLineWidth(0.8); doc.roundedRect(M, y, W() - 2 * M, hh, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(warnung ? [138, 83, 0] as [number, number, number] : AMPEL.rot)); doc.text(t(titel), M + 5, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...(warnung ? [110, 66, 0] as [number, number, number] : [142, 27, 18] as [number, number, number])); doc.text(zeilen, M + 5, y + 12.5);
    y += hh + 6;
  };
  const tabelle = (head: string[] | null, body: (string | { content: string; styles?: object })[][], opt: { summen?: number[]; spalte0?: number; schrift?: number; neg?: boolean } = {}) => {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M, top: 22, bottom: 18 },
      head: head ? [head.map(t)] : undefined,
      body: body.map(r => r.map(c => (typeof c === 'string' ? t(c) : { ...c, content: t(c.content) }))) as RowInput[],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: opt.schrift ?? 8.5, cellPadding: 1.4, textColor: TEXT, lineColor: [215, 224, 232], lineWidth: 0.15, overflow: 'linebreak' },
      headStyles: { fillColor: BLAU, textColor: 255, fontStyle: 'bold', halign: 'right' },
      columnStyles: { 0: { halign: 'left', cellWidth: opt.spalte0 ?? 'auto' } },
      didParseCell: (d: CellHookData) => {
        if (d.column.index > 0) d.cell.styles.halign = 'right';
        if (d.section === 'head' && d.column.index === 0) d.cell.styles.halign = 'left';
        if (d.section === 'body' && opt.summen?.includes(d.row.index)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [234, 243, 248]; }
        if (d.section === 'body' && opt.neg !== false && d.column.index > 0 && /^-\d/.test(String(d.cell.raw ?? ''))) d.cell.styles.textColor = [198, 40, 40];
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };
  const ampel = (x: number, yy: number, r: number, a: string) => {
    doc.setFillColor(40, 48, 56); doc.roundedRect(x - r - 1.2, yy - r - 1.2, 2 * r + 2.4, 6 * r + 4.4, 2, 2, 'F');
    (['rot', 'gelb', 'gruen'] as const).forEach((c, i) => { const on = a === c; doc.setFillColor(...(on ? AMPEL[c] : [85, 92, 100] as [number, number, number])); doc.circle(x, yy + i * (2 * r + 1), r, 'F'); });
  };
  const st = ergebnisStatus(plan);
  const fehlerW = e.warnungen.filter(w => w.fehler);
  /** erste Schätzung: negative Liquidität nur als Warnhinweis */
  const liqWarnung = e.warnungen.filter(w => !w.fehler && w.schwer && w.schritt === 'liquiditaet');
  const kd = e.kd, kapg = plan.einstellungen.rechtsform === 'KAPG';

  // ---------------- Deckblatt ----------------
  kopf(adressat);
  y = 40;
  doc.setTextColor(...GRAU); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(t(dokTitel), M, y); y += 9;
  doc.setTextColor(...BLAU); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  const titel = doc.splitTextToSize(t(plan.projekt.name || 'Finanzplan (ohne Namen)'), W() - 2 * M); doc.text(titel, M, y); y += titel.length * 9;
  if (plan.projekt.vorhaben) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...TEXT); const v = doc.splitTextToSize(t(plan.projekt.vorhaben), W() - 2 * M); doc.text(v, M, y); y += v.length * 5 + 3; }
  doc.setFillColor(...LIME); doc.rect(M, y, 30, 1.2, 'F'); y += 8;
  if (fehlerW.length) fehlerKasten('FEHLER: Plan nicht einreichungsfähig', fehlerW.map(w => w.text));
  if (liqWarnung.length) fehlerKasten('Hinweis: Liquidität negativ', liqWarnung.map(w => w.text), true);
  const d1 = md ? plan.darlehen[0] : undefined;
  tabelle(null, [
    [kapg || plan.gruender.length > 1 ? 'Gründer/innen' : 'Gründer/in', plan.gruender.map(g => g.name + (plan.einstellungen.rechtsform === 'GBR' ? ` (${g.anteil} %)` : '')).join(', ') || '–'],
    ['Rechtsform', RF[plan.einstellungen.rechtsform] + (plan.einstellungen.kleinunternehmer ? ' · Kleinunternehmer' : '')],
    ['Branche', plan.projekt.branche || '–'], ['Standort / Gemeinde', plan.projekt.gemeinde || '–'], ['Anschrift', plan.projekt.anschrift || '–'],
    ['Kontakt', [plan.projekt.telefon, plan.projekt.email].filter(Boolean).join(' · ') || '–'],
    ['Gründungsmonat (Planbeginn)', plan.projekt.gruendungsmonat || '–'],
    ['Planzweck', zweckKurz(plan)],
    ...(gz ? [['Unterlagen Gründungszuschuss', 'Kapitalbedarfsplan, Rentabilitätsvorschau (3 Jahre) und Liquiditätsplan (3 Jahre) – für die Stellungnahme der fachkundigen Stelle']] : []),
    ...(!md ? [] : [['Beantragtes Mikrodarlehen', d1 ? `${eur(d1.betrag)} · ${d1.laufzeit} Monate · davon ${d1.tilgungsfrei} tilgungsfrei · Sollzins ${pct(d1.sollzins, 2)} · ${d1.art === 'annuitaet' ? 'Annuitätendarlehen' : 'Tilgungsdarlehen'}${plan.einstellungen.folgedarlehen ? ' · Folgedarlehen' : ''}` : '–']]),
    ['Stand der Planung', schaetzung ? `Erste Schätzung, nicht zur Einreichung bestimmt · Ergebnis ${st.text}` : fehlerW.length ? `NICHT EINREICHUNGSFÄHIG (${fehlerW.length} Fehler) · Ergebnis ${st.text}` : `Ergebnis ${st.text}`],
    ['Erstellt', `${jetzt.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' })} · ThEx Finanzplan ${APP_VERSION}`],
  ], { spalte0: 55, schrift: 9.5, neg: false });

  // KPI-Kacheln
  const kacheln: [string, string, string, boolean?][] = [
    ['Umsatz Jahr 1', eur(e.jahre[0].umsatz), `J2 ${eur(e.jahre[1].umsatz)} · J3 ${eur(e.jahre[2].umsatz)}`],
    ['Ergebnis vor Steuern J1', eur(e.jahre[0].ergebnisVorSteuern), `J2 ${eur(e.jahre[1].ergebnisVorSteuern)} · J3 ${eur(e.jahre[2].ergebnisVorSteuern)}`, e.jahre[0].ergebnisVorSteuern < 0],
    ['Liquiditätstiefpunkt', eur(e.liq.tiefpunkt), `im ${e.labels[e.liq.tiefpunktIdx]}`, e.liq.tiefpunkt < 0],
    ['Kapitalbedarf', eur(e.kapitalbedarf.summe), `Finanzierung ${eur(e.finanzierung)}`, e.finanzierung < e.kapitalbedarf.summe - 0.5],
    md ? ['KD-Auslastung (Plan-Jahr 2)', pct(kd.auslastung), `Grenze ${pct(plan.params.kdGrenze, 0)}`, kd.ampel === 'rot'] : ['Liquidität Ende Jahr 3', eur(e.liq.kumuliert[35]), `Ende J1 ${eur(e.liq.kumuliert[11])} · J2 ${eur(e.liq.kumuliert[23])}`, e.liq.kumuliert[35] < 0],
    [kapg ? 'Ausschüttungen J2' : 'Ø Privatentnahme J1 / Monat', kapg ? eur(kd.ausschuettung2) : eur(jahr(e.privatentnahme, 1) / 12), kapg ? 'aus der Gesellschaft' : 'inkl. KV/PV, Rente, ESt'],
  ];
  const kw = (W() - 2 * M - 2 * 4) / 3, kh = 21;
  if (y + 2 * kh + 40 > H() - 20) neueSeite('Kennzahlen');
  h2('Kennzahlen');
  kacheln.forEach(([l, v, s, neg], i) => {
    const x = M + (i % 3) * (kw + 4), yy = y + Math.floor(i / 3) * (kh + 4);
    doc.setFillColor(244, 248, 251); doc.setDrawColor(215, 224, 232); doc.roundedRect(x, yy, kw, kh, 2, 2, 'FD');
    doc.setFillColor(...(neg ? AMPEL.rot : BLAU2)); doc.rect(x, yy, 1.3, kh, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAU); doc.text(t(l), x + 4, yy + 5.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(neg ? AMPEL.rot : TEXT)); doc.text(t(v), x + 4, yy + 12.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAU); doc.text(t(s), x + 4, yy + 17.5);
  });
  y += 2 * (kh + 4) + 4;
  if (md) {
    // KD-Kurzfazit mit Ampel (nur Mikrodarlehen)
    ampel(M + 4, y + 2, 2.6, kd.ampel);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AMPEL[kd.ampel]); doc.text(t(AMPEL_TEXT[kd.ampel]), M + 12, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text(t(`KD-Grenze ${eur(kd.grenze)} · Kapitaldienst Mikrodarlehen ${eur(kd.kapitaldienst)} · max. tragbarer Darlehensbetrag ${eur(Math.floor(kd.maxDarlehen / 100) * 100)}`), M + 12, y + 9.5);
    if (st.status !== 'bestaetigt') { doc.setTextColor(138, 83, 0); doc.text(t(`Hinweis: Ergebnis ${st.text}.`), M + 12, y + 14.5); }
  } else {
    const liqOk = e.liq.negMonate.length === 0;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(liqOk ? AMPEL.gruen : AMPEL.rot));
    doc.text(t(liqOk ? 'Liquidität in allen 36 Monaten gesichert' : `Liquidität in ${e.liq.negMonate.length} von 36 Monaten negativ`), M, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text(t(`Ergebnis vor Steuern: J1 ${eur(e.jahre[0].ergebnisVorSteuern)} · J2 ${eur(e.jahre[1].ergebnisVorSteuern)} · J3 ${eur(e.jahre[2].ergebnisVorSteuern)}`), M, y + 9.5);
    if (st.status !== 'bestaetigt') { doc.setTextColor(138, 83, 0); doc.text(t(`Hinweis: Ergebnis ${st.text}.`), M, y + 14.5); }
  }
  y += 22;
  doc.setFontSize(7.5); doc.setTextColor(...GRAU);
  const entscheider = md && gz ? 'die Kreditprüfung der Thüringer Aufbaubank noch die Stellungnahme der fachkundigen Stelle' : md ? 'die Kreditprüfung der Thüringer Aufbaubank' : gz ? 'die Stellungnahme der fachkundigen Stelle oder die Entscheidung der Agentur für Arbeit' : 'eine Gründungsberatung';
  doc.text(doc.splitTextToSize(t(`Diese Zusammenfassung wurde mit dem ThEx Finanzplan im Browser erstellt. Sie ist eine Rechenhilfe auf Basis der Angaben der Gründerin bzw. des Gründers und ersetzt weder Steuer- noch Finanzierungsberatung noch ${entscheider}. Orientierungswerte in der App sind unverbindlich.`), W() - 2 * M), M, H() - 26);

  // ---------------- Rentabilität ----------------
  neueSeite(gz ? 'Rentabilitätsvorschau' : 'Rentabilität');
  h2(gz ? 'Rentabilitätsvorschau (3 Jahre)' : 'Rentabilitätsvorschau Jahr 1–3');
  const J = e.jahre;
  const zeile = (l: string, f: (j: Ergebnis['jahre'][0]) => number) => [l, ...J.map(j => eur(f(j)))];
  tabelle(['Position', 'Jahr 1', 'Jahr 2', 'Jahr 3'], [
    zeile('Umsatzerlöse (netto)', j => j.umsatz), zeile('+ Zuschüsse / sonstige Erträge', j => j.zuschuesse), zeile('= Betriebsertrag', j => j.betriebsertrag),
    zeile('- Material / Fremdleistungen', j => -j.material), zeile('- Personal', j => -j.personal), zeile('- Abschreibungen', j => -j.afa), zeile('- Zinsen', j => -j.zinsen), zeile('- Sonstige und einmalige Kosten', j => -j.kosten),
    zeile('= Betriebsergebnis', j => j.betriebsergebnis), zeile('+/- außerordentlich', j => j.ao), zeile('= Ergebnis vor Steuern', j => j.ergebnisVorSteuern),
    zeile(kapg ? '- Gewerbe- und Körperschaftsteuer' : '- Gewerbesteuer', j => -j.betrieblicheSteuern), zeile('= Ergebnis nach betrieblichen Steuern', j => j.ergebnisNachSteuern),
    ['Umsatzrentabilität (Ergebnis vor Steuern / Umsatz)', ...J.map(j => (j.umsatz > 0 ? pct(j.ergebnisVorSteuern / j.umsatz) : '–'))],
    ['Materialquote / Personalquote', ...J.map(j => (j.umsatz > 0 ? `${pct(j.material / j.umsatz, 0)} / ${pct(j.personal / j.umsatz, 0)}` : '–'))],
  ], { summen: [2, 8, 10, 12], spalte0: 85 });
  if (!kapg) {
    h2('Privatentnahmen und private Belastung');
    tabelle(['Position', 'Jahr 1', 'Jahr 2', 'Jahr 3'], [
      ...plan.gruender.flatMap(g => [[`Private Kosten ${g.name}`, ...[0, 1, 2].map(i => eur(g.privat.reduce((s, x) => s + (x.werte[i] || 0), 0) * 12))]]),
      ...plan.gruender.map((g, gi) => [`KV/PV, Rente, ESt ${g.name}`, ...e.steuerJahre.map(sj => eur((sj.personen[gi]?.sv ?? 0) + (sj.personen[gi]?.steuer ?? 0)))]),
      ['Privatentnahme gesamt (Liquidität)', ...[1, 2, 3].map(j => eur(jahr(e.privatentnahme, j)))],
    ], { summen: [plan.gruender.length * 2], spalte0: 85 });
  }

  // ---------------- Kapitalbedarf & Finanzierung ----------------
  h2(gz ? 'Kapitalbedarfsplan und Finanzierung' : 'Kapitalbedarf und Finanzierung');
  const kb = e.kapitalbedarf, em = plan.eigenmittel;
  const fin: [string, number][] = [...e.darlehen.map(x => x.d).filter(d => !d.bestehend && d.betrag > 0).map(d => [d.bez || 'Darlehen', d.betrag] as [string, number]),
    ['Eigenmittel bar', em.bar], ['Privatdarlehen', em.privatdarlehen], ['Sachzuschuss', em.sachzuschuss], ['Sacheinlage', em.sacheinlage]].filter(x => (x[1] as number) > 0) as [string, number][];
  const bed: [string, number][] = [['Investitionen', kb.invest], ['Einmalige Betriebskosten', kb.betriebskosten], ['Gründungskosten', kb.gruendungskosten]];
  const n = Math.max(bed.length, fin.length);
  const kbRows = Array.from({ length: n }, (_, i) => [bed[i]?.[0] ?? '', bed[i] ? eur(bed[i][1]) : '', fin[i]?.[0] ?? '', fin[i] ? eur(fin[i][1]) : '']);
  kbRows.push(['Kapitalbedarf netto', eur(kb.summe), 'Finanzierung gesamt', eur(e.finanzierung)]);
  tabelle(['Kapitalbedarf', 'netto', 'Finanzierung', 'Betrag'], kbRows, { summen: [n], neg: false });
  const luecke = kb.summe - e.finanzierung;
  absatz(luecke > 0.5 ? `Finanzierungslücke: ${eur(luecke)} – der Kapitalbedarf ist nicht vollständig finanziert.` : luecke < -0.5 ? `Überdeckung: ${eur(-luecke)} stehen als Liquiditätsreserve zur Verfügung.` : 'Kapitalbedarf und Finanzierung sind ausgeglichen.', 9, luecke > 0.5 ? AMPEL.rot : TEXT);
  absatz(`Zusätzlich vorzufinanzierende Umsatzsteuer (bis zur Erstattung): ${eur(kb.ustSumme)}.`, 8.5, GRAU);
  if (plan.invest.length) tabelle(['Investition', 'netto', 'Planmonat', 'Nutzungsdauer'], plan.invest.filter(x => x.netto > 0).map(x => [x.bez || 'Investition', eur(x.netto), e.labels[Math.max(0, Math.min(35, (x.monat || 1) - 1))] ?? String(x.monat), x.gwg ? 'GWG' : `${x.ndJahre} J.`]), { schrift: 8 });

  // ---------------- Darlehen ----------------
  h2('Darlehen');
  const aktiv = e.darlehen.filter(x => x.d.betrag > 0);
  if (!aktiv.length) absatz('Keine Darlehen geplant.');
  else {
    tabelle(['Darlehen', 'Betrag', 'Laufzeit', 'tilgungsfrei', 'Sollzins', 'Art', 'Rate ab Tilgung'], aktiv.map(({ d, plan: tp }) => [d.bez || 'Darlehen', eur(d.betrag), `${d.laufzeit} Mon.`, `${d.tilgungsfrei} Mon.`, pct(d.sollzins, 2), d.art === 'annuitaet' ? 'Annuität' : 'Tilgung', eur(tp.find(z => z.tilgung > 0)?.rate ?? 0, 2)]), { schrift: 8, neg: false });
    const jz = (tp: { planMonat: number; zins: number; tilgung: number; restEnde: number }[], j: number) => { const z = tp.filter(x => x.planMonat > (j - 1) * 12 && x.planMonat <= j * 12); return { zins: z.reduce((s, x) => s + x.zins, 0), tilg: z.reduce((s, x) => s + x.tilgung, 0), rest: z.length ? z[z.length - 1].restEnde : NaN }; };
    tabelle(['Darlehen / Jahr', 'Zins J1', 'Tilgung J1', 'Zins J2', 'Tilgung J2', 'Zins J3', 'Tilgung J3', 'Rest Ende J3'], aktiv.map(({ d, plan: tp }) => { const a = [1, 2, 3].map(j => jz(tp, j)); const rest = tp.filter(x => x.planMonat <= 36).slice(-1)[0]?.restEnde ?? d.betrag; return [d.bez || 'Darlehen', ...a.flatMap(x => [eur(x.zins), eur(x.tilg)]), eur(rest)]; }), { schrift: 7.5, neg: false });
  }

  // ---------------- KD-Rechenweg (nur Mikrodarlehen) ----------------
  if (md) {
  neueSeite('Kapitaldienstfähigkeit');
  h2('Kapitaldienstfähigkeit (Plan-Jahr 2) – Rechenweg');
  ampel(W() - M - 6, y - 3, 3.2, kd.ampel);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AMPEL[kd.ampel]); doc.text(t(`${AMPEL_TEXT[kd.ampel]} – Auslastung ${pct(kd.auslastung)}`), M, y); y += 5;
  absatz(`Geprüft wird, ob nach Lebenshaltung, Sozialversicherung und Steuern genug übrig bleibt, um Zins und Tilgung des Mikrodarlehens zu tragen. Der Kapitaldienst darf höchstens ${pct(plan.params.kdGrenze, 0)} der KD-Grenze betragen (gelb ab ${pct(plan.params.kdGelb, 0)}).`, 8.5, GRAU);
  const kdRows: string[][] = [['Betriebsergebnis Plan-Jahr 2', eur(kd.be2)], ['+ Abschreibungen', eur(kd.afa2)], ['+ Zinsen Mikrodarlehen', eur(kd.zinsD1)], ['= Mittelzufluss', eur(kd.zufluss)]];
  if (!kapg) kd.entnahmenDetail.forEach(x => kdRows.push([`- Private Kosten ${x.name} (12 Monate)`, eur(-x.privat)], [`- Kranken-/Pflege-/Rentenversicherung ${x.name}`, eur(-x.sv)], [`- Einkommensteuer, Soli, KiSt ${x.name}`, eur(-x.est)]));
  else kdRows.push(['- Ausschüttungen', eur(-kd.ausschuettung2)]);
  kdRows.push(['- Gewerbesteuer', eur(-kd.gewSt2)]);
  if (kapg) kdRows.push(['- Körperschaftsteuer', eur(-kd.kst2)]);
  kdRows.push(['- Kapitaldienst weiterer / bestehender Kredite', eur(-kd.kdAndere)], ['= KD-Grenze', eur(kd.grenze)],
    [`Kapitaldienst Mikrodarlehen: Zins ${eur(kd.zinsD1, 2)} + Tilgung ${eur(kd.tilgD1, 2)}`, eur(kd.kapitaldienst)], ['Auslastung = Kapitaldienst / KD-Grenze', pct(kd.auslastung)],
    ['Max. tragbarer Darlehensbetrag (gleiche Konditionen)', eur(Math.floor(kd.maxDarlehen / 100) * 100)]);
  const sumIdx = kdRows.map((r, i) => (r[0].startsWith('=') || r[0].startsWith('Auslastung') ? i : -1)).filter(i => i >= 0);
  tabelle(['Rechenschritt', 'Betrag'], kdRows, { summen: sumIdx, spalte0: 130 });
  if (kapg) kd.tragfaehigkeit.forEach(x => absatz(`Private Tragfähigkeit ${x.name}: netto verfügbar ${eur(x.netto)} p. a. gegenüber privaten Kosten ${eur(x.bedarf)} p. a.`, 8.5, x.netto < x.bedarf ? AMPEL.rot : TEXT));
  }

  // ---------------- Liquidität ----------------
  neueSeite(gz ? 'Liquiditätsplan' : 'Liquidität', true);
  h2(gz ? 'Liquiditätsplan (3 Jahre, brutto) – Jahresübersicht und Verlauf' : 'Liquiditätsplan (brutto) – Jahresübersicht und Verlauf');
  if (fehlerW.length) fehlerKasten('FEHLER: Liquidität negativ', fehlerW.filter(w => w.schritt === 'liquiditaet').map(w => w.text));
  if (liqWarnung.length) fehlerKasten('Hinweis: Liquidität negativ', liqWarnung.map(w => w.text), true);
  const L = e.liq;
  const liqZeilen: [string, number[]][] = [
    ['Einzahlungen gesamt', L.summeEin], ['  Umsatz brutto', L.einz.umsatzBrutto], ['  Darlehen', L.einz.darlehen],
    ['  Eigenmittel, Zuschüsse, USt-Erstattung', L.einz.bar.map((x, i) => x + L.einz.privatdarlehen[i] + L.einz.sachzuschuss[i] + L.einz.zuschuesse[i] + L.einz.aoErtrag[i] + L.einz.ustErstattung[i])],
    ['Auszahlungen gesamt', L.summeAus.map(x => -x)], ['  Material, Personal, Kosten', L.ausz.material.map((x, i) => -(x + L.ausz.personal[i] + L.ausz.kosten[i] + L.ausz.einmal[i] + L.ausz.aoAufwand[i]))],
    ['  Investitionen, Kaution', L.ausz.invest.map((x, i) => -(x + L.ausz.kaution[i]))], ['  Umsatzsteuer', L.ausz.ust.map(x => -x)], ['  Zins und Tilgung', L.ausz.zinsen.map((x, i) => -(x + L.ausz.tilgung[i]))],
    ['  Betriebliche Steuern', L.ausz.steuern.map(x => -x)], [kapg ? '  Ausschüttungen' : '  Privatentnahmen', (kapg ? L.ausz.ausschuettung : L.ausz.privatentnahme).map(x => -x)],
    ['Saldo', L.saldo],
  ];
  const jr = liqZeilen.map(([l, a]) => [l, ...[1, 2, 3].map(j => eur(jahr(a, j)))]);
  jr.push(['Liquidität Ende des Jahres', ...[1, 2, 3].map(j => eur(L.kumuliert[j * 12 - 1]))]);
  jr.push(['Tiefster Stand im Jahr', ...[1, 2, 3].map(j => { const s = L.kumuliert.slice((j - 1) * 12, j * 12); const m = Math.min(...s); return `${eur(m)} (${e.labels[(j - 1) * 12 + s.indexOf(m)]})`; })]);
  const yStart = y;
  autoTable(doc, {
    startY: y, margin: { left: M, right: W() / 2 + 2, top: 22, bottom: 18 }, head: [['Position', 'Jahr 1', 'Jahr 2', 'Jahr 3'].map(t)], body: jr.map(r => r.map(t)), theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.1, textColor: TEXT, lineColor: [215, 224, 232], lineWidth: 0.15 }, headStyles: { fillColor: BLAU, textColor: 255, halign: 'right' },
    didParseCell: d => { if (d.column.index > 0) d.cell.styles.halign = 'right'; if (d.section === 'head' && d.column.index === 0) d.cell.styles.halign = 'left'; if (d.section === 'body' && [0, 4, 11, 12].includes(d.row.index)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [234, 243, 248]; } if (d.section === 'body' && d.column.index > 0 && /^-\d/.test(String(d.cell.raw))) d.cell.styles.textColor = [198, 40, 40]; },
  });
  const yEnde = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  // Diagramm Liquidität kumuliert
  const cx = W() / 2 + 8, cw = W() - M - cx, ch = 70, cy = yStart + 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEXT); doc.text(t('Liquidität kumuliert (36 Monate)'), cx, cy);
  const werte = L.kumuliert, lo = Math.min(0, ...werte), hi = Math.max(0, ...werte), span = hi - lo || 1;
  const px = (i: number) => cx + 14 + (i / 35) * (cw - 16), py = (v: number) => cy + 6 + (1 - (v - lo) / span) * ch;
  doc.setDrawColor(215, 224, 232); doc.setLineWidth(0.15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAU);
  for (let k = 0; k <= 4; k++) { const v = lo + (span * k) / 4; doc.line(cx + 14, py(v), cx + cw - 2, py(v)); doc.text(t(eur(Math.round(v / 100) * 100)), cx + 13, py(v) + 1, { align: 'right' }); }
  doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3); doc.line(cx + 14, py(0), cx + cw - 2, py(0));
  [0, 12, 24, 35].forEach(i => doc.text(t(e.labels[i]), px(i), cy + ch + 10, { align: 'center' }));
  doc.setDrawColor(...BLAU2); doc.setLineWidth(0.7);
  for (let i = 1; i < 36; i++) doc.line(px(i - 1), py(werte[i - 1]), px(i), py(werte[i]));
  doc.setFillColor(...(L.tiefpunkt < 0 ? AMPEL.rot : BLAU)); doc.circle(px(L.tiefpunktIdx), py(L.tiefpunkt), 1.1, 'F');
  doc.setTextColor(...(L.tiefpunkt < 0 ? AMPEL.rot : TEXT)); doc.text(t(`Tiefpunkt ${eur(L.tiefpunkt)} (${e.labels[L.tiefpunktIdx]})`), cx + 14, cy + ch + 16);
  y = Math.max(yEnde, cy + ch + 18) + 6;
  // Monate Jahr 1
  neueSeite('Liquidität Jahr 1 (Monate)', true);
  h2('Liquidität Jahr 1 nach Monaten');
  const monZ = [...liqZeilen, ['Liquidität kumuliert (Stand)', L.kumuliert] as [string, number[]]];
  tabelle(['Position', ...e.labels.slice(0, 12)], monZ.map(([l, a]) => [l, ...a.slice(0, 12).map(v => eur(v))]), { summen: [0, 4, 11, 12], schrift: 6.4, spalte0: 47 });
  h2('Liquidität Jahr 2 und 3 nach Quartalen');
  const q = (a: number[], stand = false) => Array.from({ length: 8 }, (_, k) => (stand ? a[12 + k * 3 + 2] : a.slice(12 + k * 3, 15 + k * 3).reduce((s, x) => s + x, 0)));
  tabelle(['Position', 'J2 Q1', 'J2 Q2', 'J2 Q3', 'J2 Q4', 'J3 Q1', 'J3 Q2', 'J3 Q3', 'J3 Q4'], [...liqZeilen.map(([l, a]) => [l, ...q(a).map(v => eur(v))]), ['Liquidität kumuliert (Quartalsende)', ...q(L.kumuliert, true).map(v => eur(v))]], { summen: [0, 4, 11, 12], schrift: 7, spalte0: 60 });

  // ---------------- Stundensatz (optional) ----------------
  if (plan.stundensatz.aktiv) {
    neueSeite('Stundensatz');
    const s = stundensatz(plan, e);
    h2(`Stundensatz – Rückwärtsrechnung (Planjahr ${plan.stundensatz.jahr})`);
    tabelle(['Position', 'Betrag p. a.'], [
      ...(!kapg ? [['Private Kosten', eur(s.privatKosten)], ['+ KV/PV/RV', eur(s.sv)], ['+ ESt, Soli, KiSt', eur(s.est)], ['- private Einnahmen / Zuschüsse', eur(-s.einnahmen)]] : []),
      ['+ Betriebliche Kosten ohne Material', eur(s.betrieb)], ['+ Kapitaldienst', eur(s.kapitaldienst)], ['+ Betriebliche Steuern', eur(s.steuern)], ...(kapg ? [['+ Ausschüttungen', eur(s.ausschuettung)]] : []),
      ['+ Gewinnaufschlag', eur(s.gewinnaufschlag)], ...(s.rohertragAndere > 0 ? [[`- Rohertrag anderer Geschäftsfelder`, eur(-s.rohertragAndere)]] : []), ['= Über Stunden zu decken', eur(s.basis)],
      ['Fakturierbare Stunden p. a.', `${Math.round(s.stunden).toLocaleString('de-DE')} h`], ['Erforderlicher Stundensatz netto', eur(s.satz, 2)], ['Erforderlicher Tagessatz netto', eur(s.tagessatz, 2)],
      ...(s.geplant > 0 ? [['Geplanter Stundensatz netto', eur(s.geplant, 2)], ['Differenz geplant - erforderlich', eur(s.differenz, 2)]] : []),
    ], { spalte0: 120 });
  }

  // ---------------- Hinweise ----------------
  if (y > H() - 60) neueSeite('Hinweise'); 
  h2('Hinweise und Plausibilitätsprüfung');
  if (st.gruende.length) st.gruende.forEach(g => absatz(`• Bitte prüfen: ${g}`, 8.5, [138, 83, 0]));
  if (!e.warnungen.length && !st.gruende.length) absatz('Keine Hinweise – alle automatischen Prüfungen ohne Auffälligkeiten.');
  else if (e.warnungen.length) tabelle(['Art', 'Hinweis'], [...fehlerW, ...e.warnungen.filter(w => !w.fehler)].map(w => [w.fehler ? { content: 'FEHLER', styles: { textColor: AMPEL.rot, fontStyle: 'bold' } } : w.schwer ? 'Kritisch' : w.plausi ? 'Plausibilität' : 'Hinweis', w.fehler ? { content: w.text, styles: { textColor: AMPEL.rot, fontStyle: 'bold' } } : w.text]), { spalte0: 26, schrift: 8, neg: false });
  absatz(schaetzung ? 'Erste Schätzung: Kritische Hinweise (z. B. negative Liquidität) blockieren nicht, müssten für einen Antrag aber behoben werden. Plausibilitätshinweise sind automatische, nicht verbindliche Prüfungen.' : 'FEHLER (rot) machen den Plan nicht einreichungsfähig und müssen behoben werden. Plausibilitätshinweise sind automatische, nicht verbindliche Prüfungen. Sie sollen Rückfragen vorwegnehmen und blockieren die Planung nicht.', 7.5, GRAU);

  // ---------------- Fußzeilen ----------------
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(215, 224, 232); doc.setLineWidth(0.2); doc.line(M, h - 11, w - M, h - 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAU);
    doc.text(t(`${plan.projekt.name || 'Finanzplan'} · ThEx Finanzplan ${APP_VERSION} · erstellt ${jetzt.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })} · Rechenhilfe${md ? ', keine Kreditentscheidung' : ''}`), M, h - 7);
    doc.text(`Seite ${i} von ${seiten}`, w - M, h - 7, { align: 'right' });
    if (fehlerW.length) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AMPEL.rot); doc.text(t('NICHT EINREICHUNGSFÄHIG – Liquidität negativ (siehe Hinweise)'), w / 2, h - 13, { align: 'center' }); }
  }
  const name = (plan.projekt.name || 'Finanzplan').replace(/[^\wÄÖÜäöüß\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Finanzplan';
  const dateiname = `Finanzplan_${name}_${zweckDateiKuerzel(plan)}_${jetzt.toISOString().slice(0, 10)}${fehlerW.length ? '_NICHT_EINREICHUNGSFAEHIG' : ''}.pdf`;
  return { blob: doc.output('blob'), dateiname, seiten, doc };
}
