import type { Plan, Gruender } from '../model/types';
import { darlehenReihen, type Tilgungszeile } from './loans';
import { gewerbesteuer, estPersonen, estGf, kapGSteuern, type EStErgebnis } from './tax';

export const M = 36;
const zeros = () => new Array(M).fill(0) as number[];
const add = (a: number[], b: number[]) => a.map((x, i) => x + (b[i] ?? 0));
export const sum = (a: number[], von = 0, bis = a.length) => a.slice(von, bis).reduce((s, x) => s + x, 0);
export const jahr = (a: number[], j: number) => sum(a, (j - 1) * 12, j * 12);
const jahrDesMonats = (m0: number) => Math.floor(m0 / 12); // 0..2

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export function monatsLabels(start: string, n = M): string[] {
  const [y, m] = (start || '2026-01').split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const t = (m - 1) + i; return `${MONATE[t % 12]} ${String((y + Math.floor(t / 12)) % 100).padStart(2, '0')}`; });
}

/** "100+50,5+20" → 170.5 (Eingabeformat des Haushaltsbuchs ohne führendes "=") */
export function summeAusText(t: string): number {
  if (!t) return 0;
  return t.replace(/^=/, '').split(/[+;\s]+/).map(s => s.trim()).filter(Boolean)
    .map(s => Number(s.replace(/\./g, '').replace(',', '.'))).filter(n => isFinite(n)).reduce((a, b) => a + b, 0);
}

export function privatKostenMonat(g: Gruender, j: number) { return g.privat.reduce((s, p) => s + (p.werte[j] || 0), 0); }

export function kontoAnalyse(anfang: number, monate: { ein: string; ende: number }[]) {
  let a = anfang;
  const zeilen = monate.map(mo => { const ein = summeAusText(mo.ein); const aus = a + ein - (mo.ende || 0); const z = { anfang: a, ein, aus, ende: mo.ende || 0 }; a = mo.ende || 0; return z; });
  const gefuellt = zeilen.filter(z => z.ein !== 0 || z.ende !== 0);
  const n = gefuellt.length || 1;
  return { zeilen, avgAus: sum(gefuellt.map(z => z.aus)) / n, avgEin: sum(gefuellt.map(z => z.ein)) / n, anzahl: gefuellt.length };
}

export interface Warnung { schritt: string; text: string; schwer?: boolean }

export function berechne(plan: Plan) {
  const p = plan.params;
  const ku = plan.einstellungen.kleinunternehmer;
  const rf = plan.einstellungen.rechtsform;
  const kapg = rf === 'KAPG';
  const ust = (s: number) => (ku ? 0 : s);
  const labels = monatsLabels(plan.projekt.gruendungsmonat);

  // 5.1 Umsatz / 5.2 Material
  const g3 = plan.umsatz.wachstumJ3;
  const umsatzGF = plan.umsatz.felder.map(f => {
    const a = zeros();
    for (let m = 0; m < 24; m++) a[m] = (f.preis[m] || 0) * (f.menge[m] || 0) * (plan.umsatz.faktor[m] ?? 1);
    for (let m = 24; m < 36; m++) a[m] = a[m - 12] * (1 + g3);
    return a;
  });
  const umsatz = umsatzGF.reduce(add, zeros());
  const ustUmsatz = umsatzGF.reduce((acc, a, i) => add(acc, a.map(x => x * ust(plan.umsatz.felder[i].ust))), zeros());
  const materialGF = umsatzGF.map((a, i) => a.map(x => x * (plan.umsatz.felder[i].materialQuote || 0)));
  const material = materialGF.reduce(add, zeros());
  const vstMaterial = materialGF.reduce((acc, a, i) => add(acc, a.map(x => x * ust(plan.umsatz.felder[i].ust))), zeros());

  // 5.3 Personal
  const personal = zeros();
  const warnungen: Warnung[] = [];
  for (const s of plan.personal) {
    for (let m = Math.max(1, s.von); m <= Math.min(M, s.bis || M); m++) {
      personal[m - 1] += s.brutto * (1 + (s.art === 'minijob' ? p.agMinijob : p.agSv));
      if (s.art === 'minijob') {
        const grenze = p.minijobWechselMonat && m >= p.minijobWechselMonat ? p.minijobGrenze2 : p.minijobGrenze1;
        if (s.brutto > grenze && m === Math.max(1, s.von)) warnungen.push({ schritt: 'personal', text: `${s.bez || 'Minijob'}: ${s.brutto} € über Minijob-Grenze (${grenze} €)` });
      }
    }
  }
  if (kapg) {
    for (const g of plan.gruender) for (let m = 0; m < M; m++) {
      const b = g.gfGehalt[jahrDesMonats(m)] || 0;
      personal[m] += b * (1 + (g.gfSvPflichtig ? p.agSv : 0));
    }
  }

  // 5.4 Investitionen, AfA, Einmalkosten
  const afa = zeros(), investNetto = zeros(), vstInvest = zeros(), investBrutto = zeros();
  for (const inv of plan.invest) {
    const m0 = Math.max(1, Math.round(inv.monat)) - 1;
    if (m0 >= M || !(inv.netto > 0)) continue;
    investNetto[m0] += inv.netto; vstInvest[m0] += inv.netto * ust(inv.ust); investBrutto[m0] += inv.netto * (1 + inv.ust);
    const brutto = ku ? inv.netto * (1 + inv.ust) : inv.netto; // KU: Vorsteuer nicht abziehbar → Kosten = Brutto
    if (inv.gwg || !(inv.ndJahre > 0)) { afa[m0] += brutto; continue; }
    const nM = Math.round(inv.ndJahre * 12);
    for (let k = 0; k < nM && m0 + k < M; k++) afa[m0 + k] += brutto / nM;
  }
  const einmal = zeros(), vstEinmal = zeros();
  for (const e of [...plan.betriebskosten, ...plan.gruendungskosten]) {
    const m0 = Math.max(1, Math.round(e.monat)) - 1; if (m0 >= M) continue;
    einmal[m0] += ku ? e.netto * (1 + e.ust) : e.netto; vstEinmal[m0] += e.netto * ust(e.ust);
  }

  // 5.5 sonstige betriebliche Kosten
  const kosten = zeros(), vstKosten = zeros();
  const { steigerungJ2: s2, steigerungJ3: s3 } = plan.kosten;
  for (const k of plan.kosten.posten) {
    for (let m = 0; m < 12; m++) {
      const v1 = k.monate[m] || 0, v2 = v1 * (1 + s2), v3 = v2 * (1 + s3);
      const f = ku ? 1 + k.ust : 1;
      kosten[m] += v1 * f; kosten[m + 12] += v2 * f; kosten[m + 24] += v3 * f;
      vstKosten[m] += v1 * ust(k.ust); vstKosten[m + 12] += v2 * ust(k.ust); vstKosten[m + 24] += v3 * ust(k.ust);
    }
  }
  const zeitraum = (liste: { betrag: number; von: number; bis: number }[]) => {
    const a = zeros();
    for (const z of liste) for (let m = Math.max(1, z.von); m <= Math.min(M, z.bis || z.von); m++) a[m - 1] += z.betrag;
    return a;
  };
  const zuschuesse = zeitraum(plan.kosten.zuschuesse), aoErtrag = zeitraum(plan.kosten.aoErtrag), aoAufwand = zeitraum(plan.kosten.aoAufwand);

  // 5.6 Darlehen
  const darlehen = plan.darlehen.map((d, i) => ({ d, i, ...darlehenReihen(d) }));
  const zinsen = darlehen.reduce((a, x) => add(a, x.zins), zeros());
  const tilgung = darlehen.reduce((a, x) => add(a, x.tilgung), zeros());
  const darlehenZufluss = darlehen.reduce((a, x) => add(a, x.auszahlung), zeros());

  // 5.7 Rentabilität
  const betriebsertrag = add(umsatz, zuschuesse);
  const aufwand = material.map((_, i) => material[i] + personal[i] + afa[i] + zinsen[i] + kosten[i] + einmal[i]);
  const betriebsergebnis = betriebsertrag.map((x, i) => x - aufwand[i]);
  const ergebnisVorSteuern = betriebsergebnis.map((x, i) => x + aoErtrag[i] - aoAufwand[i]);

  // Steuern je Jahr
  const gruender = plan.gruender.length ? plan.gruender : [];
  const anteilSumme = rf === 'GBR' ? (gruender.reduce((s, g) => s + (g.anteil || 0), 0) || 100) : 100;
  const steuerJahre = [0, 1, 2].map(j => {
    const evs = jahr(ergebnisVorSteuern, j + 1);
    if (kapg) {
      const k = kapGSteuern(evs, p);
      const gf = gruender.map(g => estGf((g.gfGehalt[j] || 0) * 12, g.ausschuettung[j] || 0, g, p));
      return { j: j + 1, ergebnis: evs, gewSt: k.gewSt, messbetrag: k.messbetrag, kst: k.kst, betrieblich: k.gewSt + k.kst, personen: [] as EStErgebnis[], gf };
    }
    const gw = rf === 'FREI' ? { messbetrag: 0, gewSt: 0 } : gewerbesteuer(evs, p, p.gewStFreibetrag);
    const personen = gruender.map(g => {
      const quote = rf === 'GBR' ? (g.anteil || 0) / anteilSumme : 1 / Math.max(1, gruender.length);
      return estPersonen(evs * quote, g, p, gw.messbetrag * quote, gw.gewSt * quote);
    });
    return { j: j + 1, ergebnis: evs, gewSt: gw.gewSt, messbetrag: gw.messbetrag, kst: 0, betrieblich: gw.gewSt, personen, gf: [] as ReturnType<typeof estGf>[] };
  });

  // 5.14 USt
  const vst = [vstMaterial, vstKosten, vstInvest, vstEinmal].reduce(add, zeros());
  const zahllast = ustUmsatz.map((x, i) => x - vst[i]); // > 0: Zahlung ans FA
  const ustZahlung = zeros();
  const modus = plan.liquiditaet.ustModus;
  for (let m = 0; m < M; m++) {
    let ziel = m;
    if (modus === 'folgemonat') ziel = m + 1; else if (modus === 'dfv') ziel = m + 2; else if (modus === 'quartal') ziel = Math.floor(m / 3) * 3 + 3;
    if (ziel < M) ustZahlung[ziel] += zahllast[m];
  }

  // Betriebliche Steuern in der Liquidität: Jahr 1 als Nachzahlung in Monat 18, Jahr 2/3 quartalsweise im jeweiligen Jahr
  const steuerZahlung = zeros();
  steuerZahlung[17] += steuerJahre[0].betrieblich;
  for (const j of [1, 2]) for (const q of [2, 5, 8, 11]) steuerZahlung[j * 12 + q] += steuerJahre[j].betrieblich / 4;

  // Privat (EU/FREI/GBR): Privatbedarf und Entnahme
  const privat = gruender.map((g, gi) => {
    const bedarf = zeros(), entnahme = zeros(), entnahmeOhneGZ = zeros(), einnahmen = zeros(), gz = zeros();
    for (let m = 0; m < M; m++) {
      const j = jahrDesMonats(m);
      const st = steuerJahre[j];
      const abgaben = kapg ? 0 : ((st.personen[gi]?.sv || 0) + (st.personen[gi]?.steuer || 0)) / 12;
      bedarf[m] = privatKostenMonat(g, j) + abgaben;
      einnahmen[m] = g.einnahmen[j] || 0;
      gz[m] = m + 1 >= g.gzVon && m + 1 <= g.gzBis ? g.gzBetrag : 0;
      entnahme[m] = kapg ? 0 : Math.max(0, bedarf[m] - einnahmen[m] - gz[m]);
      entnahmeOhneGZ[m] = kapg ? 0 : Math.max(0, bedarf[m] - einnahmen[m]);
    }
    return { g, bedarf, entnahme, entnahmeOhneGZ, einnahmen, gz };
  });
  const privatentnahme = privat.reduce((a, x) => add(a, x.entnahme), zeros());
  const privatentnahmeOhneGZ = privat.reduce((a, x) => add(a, x.entnahmeOhneGZ), zeros());
  const ausschuettung = zeros();
  if (kapg) for (const g of gruender) for (const j of [0, 1, 2]) ausschuettung[j * 12 + 11] += g.ausschuettung[j] || 0;

  // 5.8 Liquidität
  const em = plan.eigenmittel, lq = plan.liquiditaet;
  const at = (betrag: number, monat: number) => { const a = zeros(); const m0 = Math.max(1, Math.round(monat)) - 1; if (betrag && m0 < M) a[m0] = betrag; return a; };
  const umsatzBrutto = add(umsatz, ustUmsatz);
  const einz = {
    umsatzBrutto, zuschuesse, aoErtrag,
    ustErstattung: ustZahlung.map(x => (x < 0 ? -x : 0)),
    darlehen: darlehenZufluss, bar: at(em.bar, em.barMonat), privatdarlehen: at(em.privatdarlehen, em.privatdarlehenMonat), sachzuschuss: at(em.sachzuschuss, em.sachzuschussMonat),
  };
  const ausz = {
    material: add(material, vstMaterial), personal, kosten: add(kosten, vstKosten), einmal: add(einmal, vstEinmal),
    invest: investBrutto,
    kaution: at(lq.kaution, lq.kautionMonat), ust: ustZahlung.map(x => (x > 0 ? x : 0)), zinsen, tilgung, steuern: steuerZahlung, aoAufwand,
    ausschuettung, privatentnahme,
  };
  const summeEin = Object.values(einz).reduce(add, zeros());
  const summeAus = Object.values(ausz).reduce(add, zeros());
  const saldo = summeEin.map((x, i) => x - summeAus[i]);
  const kum = (a: number[]) => { let s = 0; return a.map(x => (s += x)); };
  const kumuliert = kum(saldo);
  const kumuliertOhneGZ = kum(saldo.map((x, i) => x + privatentnahme[i] - privatentnahmeOhneGZ[i]));
  const tiefpunktIdx = kumuliert.reduce((bi, x, i, a) => (x < a[bi] ? i : bi), 0);

  // 5.13 KD (Plan-Jahr 2 = Monate 13–24)
  const J2 = (a: number[]) => sum(a, 12, 24);
  const d1 = darlehen[0];
  const andere = darlehen.slice(1);
  const be2 = J2(betriebsergebnis), afa2 = J2(afa), zinsD1 = d1 ? J2(d1.zins) : 0, tilgD1 = d1 ? J2(d1.tilgung) : 0;
  const zufluss = be2 + afa2 + zinsD1;
  const st2 = steuerJahre[1];
  const entnahmenDetail = gruender.map((g, gi) => ({ name: g.name, privat: privatKostenMonat(g, 1) * 12, sv: st2.personen[gi]?.sv || 0, est: st2.personen[gi]?.steuer || 0 }));
  const entnahmen = kapg ? 0 : entnahmenDetail.reduce((s, e) => s + e.privat + e.sv + e.est, 0);
  const ausschuettung2 = kapg ? gruender.reduce((s, g) => s + (g.ausschuettung[1] || 0), 0) : 0;
  const kdAndere = andere.reduce((s, x) => s + J2(x.zins) + J2(x.tilgung), 0);
  const grenze = zufluss - entnahmen - ausschuettung2 - st2.gewSt - st2.kst - kdAndere;
  const kapitaldienst = zinsD1 + tilgD1;
  const auslastung = grenze > 0 ? kapitaldienst / grenze : Infinity;
  const ampel: 'gruen' | 'gelb' | 'rot' = grenze <= 0 || auslastung > p.kdGrenze ? 'rot' : auslastung > p.kdGelb ? 'gelb' : 'gruen';
  // max. tragbarer Darlehensbetrag (Kapitaldienst ist linear im Betrag; Steuerrückwirkung vernachlässigt)
  let kdJeEuro = 0;
  if (d1) {
    const probe = darlehenReihen({ ...d1.d, betrag: 10000 });
    kdJeEuro = (J2(probe.zins) + J2(probe.tilgung)) / 10000;
  }
  const maxDarlehen = grenze > 0 && kdJeEuro > 0 ? (p.kdGrenze * grenze) / kdJeEuro : 0;
  const tragfaehigkeit = kapg ? gruender.map(g => { const gf = st2.gf[gruender.indexOf(g)]; return { name: g.name, netto: gf?.netto || 0, bedarf: privatKostenMonat(g, 1) * 12 }; }) : [];
  const kd = { be2, afa2, zinsD1, tilgD1, zufluss, entnahmen, entnahmenDetail, ausschuettung2, gewSt2: st2.gewSt, kst2: st2.kst, kdAndere, grenze, kapitaldienst, auslastung, ampel, maxDarlehen, kdJeEuro, tragfaehigkeit };

  // Warnungen
  if (sum(umsatz, 0, 12) <= 0) warnungen.push({ schritt: 'umsatz', text: 'Umsatz im Plan-Jahr 1 ist 0 €.' });
  plan.umsatz.felder.forEach(f => { if (f.materialQuote > 0.8) warnungen.push({ schritt: 'umsatz', text: `${f.name}: Materialquote über 80 %.` }); });
  if (kumuliert[tiefpunktIdx] < 0) warnungen.push({ schritt: 'liquiditaet', text: `Liquidität wird negativ: tiefster Stand ${Math.round(kumuliert[tiefpunktIdx]).toLocaleString('de-DE')} € im ${labels[tiefpunktIdx]}.`, schwer: true });
  const md = plan.darlehen[0];
  if (md && md.betrag > 0 && (md.betrag < 5000 || md.betrag > 35000) && !plan.einstellungen.folgedarlehen) warnungen.push({ schritt: 'darlehen', text: 'Mikrodarlehen: zulässig sind 5.000 € bis 35.000 €.' });
  if (md && plan.einstellungen.folgedarlehen && md.betrag > 45000) warnungen.push({ schritt: 'darlehen', text: 'Mikrodarlehen inkl. Folgedarlehen: max. 45.000 € gesamt.' });
  if (md && (md.laufzeit > 84 || md.tilgungsfrei > 12)) warnungen.push({ schritt: 'darlehen', text: 'Mikrodarlehen: max. 84 Monate Laufzeit, max. 12 Monate tilgungsfrei.' });
  if (ampel === 'rot') warnungen.push({ schritt: 'ergebnis', text: grenze <= 0 ? 'KD-Grenze ist nicht positiv – Kapitaldienstfähigkeit nicht gegeben.' : `KD-Auslastung ${(auslastung * 100).toFixed(1)} % liegt über ${(p.kdGrenze * 100).toFixed(0)} %.`, schwer: true });
  if (rf === 'GBR' && Math.abs(anteilSumme - 100) > 0.01) warnungen.push({ schritt: 'projekt', text: `Gewinnanteile der Gesellschafter ergeben ${anteilSumme} % statt 100 %.` });
  gruender.forEach(g => { const k = privatKostenMonat(g, 0); if (k > 0 && k < 1000 && !(g.einnahmen[0] > 0)) warnungen.push({ schritt: 'privat', text: `${g.name}: private Kosten unter 1.000 €/Monat ohne weitere Einnahmen – bitte prüfen.` }); });
  tragfaehigkeit.forEach(t => { if (t.netto < t.bedarf) warnungen.push({ schritt: 'ergebnis', text: `${t.name}: Netto-GF-Gehalt + Ausschüttung (${Math.round(t.netto)} €) decken private Kosten Jahr 2 (${Math.round(t.bedarf)} €) nicht.` }); });

  const jahre = [1, 2, 3].map(j => ({
    umsatz: jahr(umsatz, j), zuschuesse: jahr(zuschuesse, j), betriebsertrag: jahr(betriebsertrag, j), material: jahr(material, j), personal: jahr(personal, j), afa: jahr(afa, j),
    zinsen: jahr(zinsen, j), kosten: jahr(kosten, j) + jahr(einmal, j), betriebsergebnis: jahr(betriebsergebnis, j), ao: jahr(aoErtrag, j) - jahr(aoAufwand, j),
    ergebnisVorSteuern: jahr(ergebnisVorSteuern, j), betrieblicheSteuern: steuerJahre[j - 1].betrieblich,
    ergebnisNachSteuern: jahr(ergebnisVorSteuern, j) - steuerJahre[j - 1].betrieblich,
  }));

  const kapitalbedarf = {
    invest: plan.invest.reduce((s, x) => s + x.netto, 0), betriebskosten: plan.betriebskosten.reduce((s, x) => s + x.netto, 0), gruendungskosten: plan.gruendungskosten.reduce((s, x) => s + x.netto, 0),
    ustSumme: plan.invest.reduce((s, x) => s + x.netto * x.ust, 0) + [...plan.betriebskosten, ...plan.gruendungskosten].reduce((s, x) => s + x.netto * x.ust, 0),
  };
  const finanzierung = plan.darlehen.filter(d => !d.bestehend).reduce((s, d) => s + d.betrag, 0) + em.bar + em.privatdarlehen + em.sachzuschuss + em.sacheinlage;

  return {
    labels, umsatzGF, umsatz, umsatzBrutto, ustUmsatz, material, personal, afa, einmal, kosten, zinsen, tilgung, zuschuesse, aoErtrag, aoAufwand,
    betriebsertrag, aufwand, betriebsergebnis, ergebnisVorSteuern, jahre, steuerJahre,
    ust: { ust: ustUmsatz, vst, zahllast, zahlung: ustZahlung },
    liq: { einz, ausz, summeEin, summeAus, saldo, kumuliert, kumuliertOhneGZ, tiefpunktIdx, tiefpunkt: kumuliert[tiefpunktIdx] },
    privat, privatentnahme, darlehen: darlehen.map(x => ({ d: x.d, plan: x.plan as Tilgungszeile[] })), kd, warnungen,
    kapitalbedarf: { ...kapitalbedarf, summe: kapitalbedarf.invest + kapitalbedarf.betriebskosten + kapitalbedarf.gruendungskosten }, finanzierung,
  };
}
export type Ergebnis = ReturnType<typeof berechne>;

/** Stundensatz (optional, Spec 5.15) */
export function stundensatz(plan: Plan, e: Ergebnis) {
  const s = plan.stundensatz, j = s.jahr;
  const privat = plan.einstellungen.rechtsform === 'KAPG'
    ? plan.gruender.reduce((a, g) => a + (g.gfGehalt[j - 1] || 0) * 12, 0)
    : e.privat.reduce((a, x) => a + jahr(x.bedarf, j), 0);
  const betrieb = jahr(e.personal, j) + jahr(e.kosten, j) + jahr(e.einmal, j) + (plan.einstellungen.rechtsform === 'KAPG' ? -plan.gruender.reduce((a, g) => a + (g.gfGehalt[j - 1] || 0) * 12, 0) : 0);
  const kapitaldienst = jahr(e.zinsen, j) + jahr(e.tilgung, j);
  const basis = privat + betrieb + kapitaldienst + e.steuerJahre[j - 1].betrieblich + s.gewinnaufschlag;
  const tage = Math.max(0, s.arbeitstage - s.urlaub - s.krankheit - s.feiertage);
  const hTag = Math.max(0, s.stundenTag - s.unproduktiv);
  const stunden = tage * hTag * (1 - s.ausfall);
  const satz = stunden > 0 ? basis / stunden : 0;
  return { privat, betrieb, kapitaldienst, steuern: e.steuerJahre[j - 1].betrieblich, gewinnaufschlag: s.gewinnaufschlag, basis, tage, hTag, stunden, satz, tagessatz: satz * hTag };
}

export function sollIstZeilen(e: Ergebnis): [string, string, number[]][] {
  return [['umsatz', 'Umsatz', e.umsatz], ['zuschuesse', 'Zuschüsse', e.zuschuesse], ['material', 'Material', e.material], ['personal', 'Personal', e.personal], ['afa', 'Abschreibungen', e.afa], ['zinsen', 'Zinsen', e.zinsen], ['kosten', 'Sonstige Kosten (inkl. einmalig)', e.kosten.map((x, i) => x + e.einmal[i])], ['betriebsergebnis', 'Betriebsergebnis', e.betriebsergebnis]];
}

