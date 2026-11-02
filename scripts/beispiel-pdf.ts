// Erzeugt ../beispiel_tab.pdf aus dem Beispielprojekt (fiktive Daten): npx vite-node scripts/beispiel-pdf.ts [ziel]
import { writeFileSync } from 'node:fs';
import { beispielPlan } from '../src/model/beispiel';
import { STEPS, standErgaenzen, bestaetige } from '../src/model/schritte';
import { erstellePdf } from '../src/io/pdf';

const p = beispielPlan();
p.meta.haftungBestaetigt = true;
STEPS.filter(s => s.art === 'pflicht').forEach(s => (p.meta.erledigt[s.id] = true));
standErgaenzen(p);
p.meta.bestaetigtAm = new Date().toISOString();
bestaetige('ergebnis', p);
p.stundensatz.aktiv = true;
const { doc, seiten, dateiname } = await erstellePdf(p);
const ziel = process.argv[2] ?? '../beispiel_tab.pdf';
writeFileSync(ziel, Buffer.from(doc.output('arraybuffer')));
console.log(`${ziel}: ${seiten} Seiten (${dateiname})`);
