// End-to-End: Tutorial, geführte Freischaltung, Dashboard, Export → (Änderung in Excel) → Import mit Bestätigung, Screenshots
import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
const URL = process.env.APP_URL || 'http://localhost:4173/thex-finanzplan/';
const OUT = '../screenshots';
const log = (...a) => console.log('•', ...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-DE' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', d => d.accept());
await page.goto(URL);
await page.getByRole('dialog', { name: 'Einführung' }).waitFor();
await page.screenshot({ path: `${OUT}/01_tutorial.png` });
log('Tutorial sichtbar');
while (await page.getByRole('button', { name: 'Weiter' }).isVisible()) await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: "Los geht's" }).click();
// gesperrter Schritt prüfen
await page.locator('nav.sidebar button', { hasText: 'Umsatzplanung' }).click();
if (!(await page.locator('.locked-box').isVisible())) throw new Error('Umsatzplanung sollte gesperrt sein');
log('Sperre ok');
await page.locator('nav.sidebar button', { hasText: 'Start & Einstellungen' }).click();
// Abschließen ohne Haftung → Fehler
await page.getByRole('button', { name: /Schritt abschließen/ }).click();
await page.getByRole('alert').waitFor(); log('Validierung ok');
await page.getByRole('button', { name: 'Beispielprojekt laden' }).click();
// alle Pflichtschritte abschließen
for (let i = 0; i < 12; i++) {
  const h = await page.locator('.step-head h2').innerText();
  if (h.startsWith('Ergebnis')) break;
  if (h === 'Umsatzplanung') { await page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.screenshot({ path: `${OUT}/02_umsatzplanung.png`, fullPage: false }); }
  await page.locator('.step-foot .btn.primary').click();
  await page.waitForFunction(old => document.querySelector('.step-head h2')?.textContent !== old || document.querySelector('[role=alert]'), h);
  if (await page.getByRole('alert').isVisible().catch(() => false)) throw new Error('Validierungsfehler in ' + h + ': ' + await page.getByRole('alert').innerText());
}
await page.locator('.dashboard').waitFor();
const kd1 = await page.locator('.kd-kpis').innerText();
log('Dashboard erreicht:', kd1.replace(/\n/g, ' | '));
await page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
await page.screenshot({ path: `${OUT}/03_dashboard.png`, fullPage: true });
await page.locator('.card.kd details summary').click();
await page.locator('.card.kd').screenshot({ path: `${OUT}/04_kd_rechenweg.png` });
// Export
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel exportieren', exact: true }).click()]);
const file = `/tmp/${dl.suggestedFilename()}`; await dl.saveAs(file); log('Export:', file, fs.statSync(file).size, 'Bytes');
// in "Excel" ändern: Darlehensbetrag 25.000 → 30.000 und Miete privat J1 600 → 700
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
log('Blätter:', wb.worksheets.map(w => `${w.name}${w.state !== 'visible' ? '(' + w.state + ')' : ''}`).join(', '));
const map = {}; wb.getWorksheet('_daten').eachRow((r, i) => { if (i > 1 && r.getCell(5).value) map[r.getCell(5).value] = [r.getCell(3).value, r.getCell(4).value]; });
const setz = (path, v) => { const [s, a] = map[path]; wb.getWorksheet(s).getCell(a).value = v; };
setz('darlehen.0.betrag', 30000); setz('gruender.0.privat.0.werte.0', 700);
const file2 = '/tmp/geaendert.xlsx'; await wb.xlsx.writeFile(file2);
// Import
await page.getByTestId('import-input').setInputFiles(file2);
const dlg = page.getByRole('dialog', { name: 'Import bestätigen' }); await dlg.waitFor();
await page.screenshot({ path: `${OUT}/05_import_bestaetigung.png` });
const dtext = await dlg.innerText(); log('Import-Dialog:', dtext.split('\n').filter(l => /Änderung|30000|700/.test(l)).join(' | '));
await dlg.getByRole('button', { name: 'Übernehmen' }).click();
await page.locator('nav.sidebar button', { hasText: 'Ergebnis' }).click();
const kd2 = await page.locator('.kd-kpis').innerText();
log('nach Import:', kd2.replace(/\n/g, ' | '));
if (kd1 === kd2) throw new Error('KD hat sich nach Import nicht geändert');
// Unveränderter Round-Trip: erneuter Export und Import → keine Änderungen
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel exportieren', exact: true }).click()]);
const file3 = '/tmp/rt.xlsx'; await dl2.saveAs(file3);
await page.getByTestId('import-input').setInputFiles(file3);
await dlg.waitFor(); const t3 = await dlg.innerText();
if (!t3.includes('keine Änderungen')) throw new Error('Round-Trip ohne Änderung meldet Änderungen');
log('Round-Trip unverändert: keine Änderungen, Hash:', t3.includes('Datenblock unverändert') ? 'ok' : 'FEHLER');
await dlg.getByRole('button', { name: 'Abbrechen' }).click();
fs.copyFileSync(file, `${OUT}/../beispiel_export.xlsx`);
if (errors.length) { console.log('Browser-Fehler:', errors); process.exitCode = 1; }
await browser.close();
log('E2E fertig');
