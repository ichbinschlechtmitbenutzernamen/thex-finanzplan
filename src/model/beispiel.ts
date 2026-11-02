import type { Plan } from './types';
import { leererPlan, neuesFeld, uid } from './defaults';

/** Beispielplan „Muster Werkstatt“ – für Tutorial-Demo, Tests und Screenshots */
export function beispielPlan(): Plan {
  const p = leererPlan();
  p.projekt = { ...p.projekt, name: 'Muster Werkstatt', vorhaben: 'Fahrradwerkstatt mit Ersatzteilverkauf', anschrift: 'Musterstraße 1, 07743 Jena', branche: 'Handwerk / Handel', gemeinde: 'Jena', gruendungsmonat: '2027-01' };
  const g = p.gruender[0];
  g.name = 'Max Muster';
  const set = (bez: string, v: number) => { const x = g.privat.find(q => q.bez === bez)!; x.werte = [v, v, v]; };
  set('Miete / Hausgeld', 600); set('Strom, Heizung, Nebenkosten', 120); set('Lebensmittel, Drogerie', 400); set('Telefon, Internet, Rundfunk', 50); set('Sonstige Lebenshaltung', 100); set('Haftpflicht / Hausrat', 20);
  g.gzBetrag = 0; g.gzVon = 1; g.gzBis = 6;
  const f1 = neuesFeld('Reparatur & Service'); f1.ust = 0.19; f1.materialQuote = 0.1;
  const f2 = neuesFeld('Ersatzteile & Zubehör'); f2.ust = 0.19; f2.materialQuote = 0.45;
  for (let m = 0; m < 24; m++) {
    f1.preis[m] = 55; f1.menge[m] = Math.min(95, 35 + m * 4);
    f2.preis[m] = 30; f2.menge[m] = Math.min(110, 40 + m * 4);
  }
  p.umsatz.felder = [f1, f2];
  p.umsatz.faktor = p.umsatz.faktor.map((_, m) => (m === 0 ? 0.6 : m === 1 ? 0.8 : 1));
  const k = (bez: string, v: number) => { const x = p.kosten.posten.find(q => q.bez === bez)!; x.monate = x.monate.map(() => v); };
  k('Miete Geschäftsräume', 650); k('Nebenkosten / Energie', 120); k('Betriebliche Versicherungen', 60); k('Beiträge (IHK/HWK, BG, Verbände)', 25); k('Kfz-Kosten (betrieblich)', 180);
  k('Werbung / Marketing', 150); k('Website / Software / Lizenzen', 40); k('Telefon / Internet', 45); k('Büromaterial / Porto', 25); k('Steuerberatung / Buchhaltung', 180); k('Kontoführung / Zahlungsgebühren', 15);
  p.invest = [
    { id: uid(), bez: 'Werkstattausstattung', netto: 9000, ust: 0.19, monat: 1, ndJahre: 10, gwg: false },
    { id: uid(), bez: 'Lastenrad (Service-Fahrzeug)', netto: 4200, ust: 0.19, monat: 1, ndJahre: 7, gwg: false },
    { id: uid(), bez: 'Laptop + Kasse', netto: 1800, ust: 0.19, monat: 1, ndJahre: 3, gwg: false },
    { id: uid(), bez: 'Spezialwerkzeug', netto: 750, ust: 0.19, monat: 1, ndJahre: 0, gwg: true },
  ];
  p.betriebskosten = [{ id: uid(), bez: 'Erstausstattung Ersatzteillager', netto: 3000, ust: 0.19, monat: 1 }];
  p.gruendungskosten = [{ id: uid(), bez: 'Gewerbeanmeldung, Beratung, Notar', netto: 600, ust: 0.19, monat: 1 }];
  p.darlehen[0].betrag = 25000;
  p.eigenmittel.bar = 4000;
  p.liquiditaet.kaution = 1950;
  return p;
}
