import type { Darlehen } from '../model/types';

export interface Tilgungszeile { k: number; planMonat: number; restAnfang: number; zins: number; tilgung: number; rate: number; restEnde: number }

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Tilgungsplan je Darlehen (Spec 5.6).
 * Tilgungsdarlehen: konstante Tilgung K/(n−f) nach f tilgungsfreien Monaten, Zins = Restschuld × Sollzins/12.
 * Annuitätendarlehen: in tilgungsfreien Monaten nur Zins, danach konstante Rate A = K·r/(1−(1+r)^−(n−f)).
 * Zins und Tilgung monatlich nachträglich im jeweiligen Darlehensmonat. Bestehende Kredite: Planmonat 1 = erster Monat.
 */
export function tilgungsplan(d: Darlehen): Tilgungszeile[] {
  const K = d.betrag, n = Math.round(d.laufzeit), f = Math.round(d.tilgungsfrei), r = d.sollzins / 12;
  if (!(K > 0) || !(n > 0) || n <= f || f < 0) return [];
  const start = d.bestehend ? 1 : Math.max(1, Math.round(d.auszahlungMonat));
  const out: Tilgungszeile[] = [];
  let rest = K;
  const T = K / (n - f);
  const A = r === 0 ? K / (n - f) : (K * r) / (1 - Math.pow(1 + r, -(n - f)));
  for (let k = 1; k <= n; k++) {
    const zins = rest * r;
    let tilgung = 0;
    if (k > f) tilgung = d.art === 'tilgung' ? T : A - zins;
    if (k === n || tilgung > rest) tilgung = rest; // letzte Rate gleicht Rundungsrest aus
    const restEnde = rest - tilgung;
    out.push({ k, planMonat: start + k - 1, restAnfang: rest, zins, tilgung, rate: zins + tilgung, restEnde: Math.abs(restEnde) < 1e-9 ? 0 : restEnde });
    rest = restEnde;
  }
  return out;
}

/** Zins- und Tilgungsreihen über 36 Planmonate (Index 0 = Monat 1) */
export function darlehenReihen(d: Darlehen, monate = 36) {
  const zins = new Array(monate).fill(0), tilgung = new Array(monate).fill(0), auszahlung = new Array(monate).fill(0);
  const plan = tilgungsplan(d);
  for (const z of plan) {
    if (z.planMonat >= 1 && z.planMonat <= monate) { zins[z.planMonat - 1] += z.zins; tilgung[z.planMonat - 1] += z.tilgung; }
  }
  if (!d.bestehend && d.betrag > 0) {
    const m = Math.max(1, Math.round(d.auszahlungMonat));
    if (m <= monate) auszahlung[m - 1] = d.betrag;
  }
  return { zins, tilgung, auszahlung, plan };
}

export { r2 };
