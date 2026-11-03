import { describe, it, expect, beforeEach } from 'vitest';
import { beispielPlan } from '../model/beispiel';
import { leererPlan } from '../model/defaults';
import { STEPS, freigeschaltet, bittePruefen, ergebnisStatus, standErgaenzen, bestaetige } from '../model/schritte';
import { laden, speichern, zuruecksetzen } from '../io/storage';
import { APP_VERSION } from '../version';

/** einfacher localStorage-Ersatz für die Node-Testumgebung */
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

function musterFertig() {
  const p = beispielPlan();
  p.meta.haftungBestaetigt = true; p.meta.tutorialGesehen = true;
  STEPS.filter(s => s.art === 'pflicht').forEach(s => (p.meta.erledigt[s.id] = true));
  standErgaenzen(p);
  p.meta.bestaetigtAm = '2026-11-02T20:00:00.000Z'; bestaetige('ergebnis', p);
  return p;
}
/** Plan ohne zufällige IDs/Zeitstempel – zum Vergleich mit einem frischen Plan */
const inhalt = (p: any) => JSON.parse(JSON.stringify(p, (k, v) => (k === 'id' || k === 'erstellt' || k === 'geaendert' ? undefined : v)));

describe('Reset (v1.2)', () => {
  it('Version ist gesetzt (aktuell 1.3.x)', () => expect(APP_VERSION).toMatch(/^1\.3\.\d+$/));
  it('Reset nach „Muster Werkstatt“: alle Felder leer, Schritte gesperrt, keine Markierungen, nicht bestätigt', () => {
    const muster = musterFertig();
    speichern(muster);
    expect(laden().projekt.name).toBe('Muster Werkstatt');
    expect(freigeschaltet('ergebnis', muster)).toBe(true);

    const p = zuruecksetzen();
    expect(inhalt(p)).toEqual(inhalt(leererPlan()));
    expect(p.projekt.name).toBe('');
    expect(p.gruender).toHaveLength(1);
    expect(p.gruender.every(g => g.name === 'Gründer/in 1' && g.privat.every(x => x.werte.every(w => !w)))).toBe(true);
    expect(p.umsatz.felder.every(f => f.menge.every(m => !m) && f.preis.every(x => !x))).toBe(true);
    expect(p.invest.every(x => !x.netto)).toBe(true);
    expect(p.meta.erledigt).toEqual({});
    expect(p.meta.bestaetigtAm).toBeFalsy();
    expect(p.meta.haftungBestaetigt).toBe(false);
    expect(p.meta.tutorialGesehen).toBe(false);
    expect(bittePruefen(p)).toEqual({});
    expect(ergebnisStatus(p).status).toBe('offen');
    for (const s of STEPS.filter(x => x.id !== 'start')) expect(freigeschaltet(s.id, p), s.id).toBe(false);
    expect(freigeschaltet('start', p)).toBe(true);
  });
  it('löscht die gespeicherten Plandaten im localStorage (auch weitere App-Schlüssel), fremde Schlüssel bleiben', () => {
    speichern(musterFertig());
    localStorage.setItem('thex-finanzplan:tmp', 'x');
    localStorage.setItem('andere-app', 'bleibt');
    zuruecksetzen();
    expect(localStorage.getItem('thex-finanzplan:v1')).toBeNull();
    expect(localStorage.getItem('thex-finanzplan:tmp')).toBeNull();
    expect(localStorage.getItem('andere-app')).toBe('bleibt');
    expect(laden().projekt.name).toBe('');
  });
  it('ohne Reset (Abbrechen) bleiben die Daten erhalten', () => {
    speichern(musterFertig());
    const p = laden();
    expect(p.projekt.name).toBe('Muster Werkstatt');
    expect(p.meta.bestaetigtAm).toBeTruthy();
    expect(ergebnisStatus(p).status).toBe('bestaetigt');
  });
});
