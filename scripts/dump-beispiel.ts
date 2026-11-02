import { beispielPlan } from '../src/model/beispiel';
import { berechne } from '../src/calc/plan';

const p = beispielPlan(); const e: any = berechne(p);
const pick = (k: string) => e[k];
console.log(JSON.stringify({
  plan: { kostenS2: p.kosten.steigerungJ2, kostenS3: p.kosten.steigerungJ3, umsatzJ3: p.umsatz.wachstumJ3, faktor: p.umsatz.faktor },
  umsatz: pick('umsatz'), material: pick('material'), personal: pick('personal'), afa: pick('afa'), kosten: pick('kosten'), einmal: pick('einmal'),
  zinsen: pick('zinsen'), tilgung: pick('tilgung'), be: pick('betriebsergebnis'), evs: pick('ergebnisVorSteuern'),
  jahre: e.jahre, steuerJahre: e.steuerJahre,
}));
