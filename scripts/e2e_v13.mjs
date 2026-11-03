// End-to-End v1.3: Planzweck (Schätzung / Gründungszuschuss / Mikrodarlehen), leerer Plan ohne Liquiditätsfehler,
// Umschalten mit Datenerhalt, Import einer alten Datei (v1.2) – Screenshots v13_*.png
import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const URL = process.env.APP_URL || 'http://localhost:4173/thex-finanzplan/';
const OUT = '../screenshots';
const log = (...a) => console.log('•', ...a);
const check = (c, msg) => { if (!c) throw new Error('FEHLER: ' + msg); log('ok –', msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-DE' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', d => d.accept());
const ruhig = () => page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
const nav = () => page.locator('nav.sidebar').innerText();
const tutorial = page.getByRole('dialog', { name: 'Einführung' });
const folienTitel = async () => { const t = []; for (;;) { t.push(await tutorial.locator('h2, h3').first().innerText()); if (!(await page.getByRole('button', { name: 'Weiter' }).isVisible())) break; await page.getByRole('button', { name: 'Weiter' }).click(); } return t; };
const zuSchritt = t => page.locator('nav.sidebar button', { hasText: t }).first().click();
const durchlaufen = async (beiLiq) => {
  for (let i = 0; i < 14; i++) {
    const h = await page.locator('.step-head h2').innerText();
    if (h.startsWith('Ergebnis')) return;
    if (h.startsWith('Liquidität') && beiLiq) await beiLiq();
    await page.locator('.step-foot .btn.primary').click();
    await page.waitForFunction(old => document.querySelector('.step-head h2')?.textContent !== old || document.querySelector('[role=alert]'), h);
    if ((await page.locator('.step-head h2').innerText()) === h) throw new Error('Validierungsfehler in ' + h + ': ' + await page.getByRole('alert').innerText());
  }
};
const setzeZahl = async (label, wert) => { const f = page.getByLabel(label, { exact: true }); await f.fill(String(wert)); await f.press('Tab'); };

// ---------- 1. Neuer Plan: Zweck-Auswahl in Einführung und Schritt 0 ----------
await page.goto(URL);
await tutorial.waitFor();
check(await tutorial.getByTestId('zweck-auswahl').isVisible(), 'Einführung fragt „Wofür erstellen Sie den Finanzplan?“');
const t0 = await folienTitel();
check(t0.length === 4 && !t0.includes('Was ist Kapitaldienstfähigkeit?'), `ohne Zweck 4 Folien, keine KD-Folie (${t0.join(' / ')})`);
await page.getByRole('button', { name: "Los geht's" }).click();
check((await page.locator('.step-head h2').innerText()) === 'Start & Einstellungen', 'Schritt 0');
await page.getByRole('button', { name: /Schritt abschließen/ }).click();
check((await page.getByRole('alert').innerText()).includes('mindestens einen Planzweck'), 'ohne Planzweck nicht abschließbar');
// ---------- 2. Leerer Plan: kein Liquiditätsfehler ----------
check(await page.getByTestId('side-liq-info').isVisible() && !(await page.getByTestId('side-liq-fehler').count()), 'leerer Plan: Seitenleiste ohne Liquiditätsfehler (nur Info)');
await page.getByTestId('zweck-md').first().click();
check(await page.getByTestId('side-kd').isVisible() && !(await page.getByTestId('side-liq-fehler').count()), 'auch mit Mikrodarlehen: KD-Ampel leer, kein −10.290-€-Fehler');
await ruhig();
await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main, .main, .content').forEach(el => (el.scrollTop = 0)); });
await page.screenshot({ path: `${OUT}/v13_leerer_plan_ohne_fehler.png` });
// zurück auf Gründungszuschuss
await page.getByTestId('zweck-gz').first().click();
await page.getByTestId('zweck-md').first().click();
check((await page.getByTestId('side-zweck').innerText()).includes('Gründungszuschuss') && !(await page.getByTestId('side-zweck').innerText()).includes('Mikrodarlehen'), 'Zweck: nur Gründungszuschuss');
// letzter Zweck lässt sich nicht abwählen
await page.getByTestId('zweck-gz').first().click();
check(await page.getByTestId('zweck-gz').first().locator('input').isChecked(), 'letzter Zweck bleibt gewählt (Mindestens einer)');
await ruhig();
await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main, .main, .content').forEach(el => (el.scrollTop = 0)); });
await page.screenshot({ path: `${OUT}/v13_zweck_auswahl.png` });

// ---------- 3. Nur Gründungszuschuss mit Beispielprojekt ----------
await page.getByRole('button', { name: 'Beispielprojekt laden' }).click();
await page.waitForFunction(() => document.querySelector('.topbar .proj')?.textContent?.includes('Muster Werkstatt'));
check((await page.getByTestId('side-zweck').innerText()).includes('Gründungszuschuss'), 'Beispielprojekt übernimmt den gewählten Zweck');
check(!(await page.getByTestId('side-kd').count()), 'Seitenleiste: keine KD-Ampel ohne Mikrodarlehen');
await page.locator('details.menu summary').click();
check(!(await page.locator('details.menu').getByText(/Prüfer/).count()), 'Menü: kein Prüfer-/Kontoauszugsbereich');
await page.locator('details.menu summary').click();
await durchlaufen(async () => { await setzeZahl('Barmittel / Einlage Betrag', 30000); });
const n1 = await nav();
check(!/KD-Prüfung|Kontoauszüge|Soll-Ist/.test(n1) && /Ergebnis/.test(n1), 'Navigation ohne KD-Prüfung, Kontoauszüge, Soll-Ist');
check((await page.locator('.step-head h2').innerText()) === 'Ergebnis', 'Ergebnis-Schritt heißt „Ergebnis“');
check(!(await page.locator('.card.kd').count()) && await page.getByTestId('gz-hinweis').isVisible(), 'Dashboard ohne KD-Block, mit GZ-Hinweis');
await page.getByTestId('ergebnis-bestaetigen').click();
await zuSchritt('Finanzierung');
check(await page.getByText(/Mikrodarlehen der TAB.*ausgeblendet/).isVisible(), 'Finanzierung: Mikrodarlehen ausgeblendet (Daten bleiben)');
await ruhig();
await page.screenshot({ path: `${OUT}/v13_navigation_ohne_md.png` });
// PDF
await zuSchritt('Ergebnis');
const [pdfDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF erstellen' }).first().click()]);
const pdf = `/tmp/${pdfDl.suggestedFilename()}`; await pdfDl.saveAs(pdf);
check(/_GZ_\d{4}-\d\d-\d\d\.pdf$/.test(pdf), `PDF-Dateiname ${pdfDl.suggestedFilename()}`);
const ptxt = execFileSync('pdftotext', ['-l', '1', pdf, '-']).toString();
check(ptxt.includes('Finanzplan – Gründungszuschuss') && !ptxt.includes('Beantragtes Mikrodarlehen'), 'PDF-Titel „Finanzplan – Gründungszuschuss“, kein Mikrodarlehen');
const alle = execFileSync('pdftotext', [pdf, '-']).toString();
check(!/Kapitaldienstfähigkeit|Rechenweg/.test(alle) && /Kapitalbedarfsplan/.test(alle) && /Rentabilitätsvorschau \(3 Jahre\)/.test(alle), 'PDF: GZ-Abschnitte, keine KD-Seite');
execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', '-singlefile', pdf, `${OUT}/v13_pdf_titel_gz`]);
check(fs.existsSync(`${OUT}/v13_pdf_titel_gz.png`), 'Screenshot PDF-Titel');
// Excel
const [xDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel exportieren', exact: true }).click()]);
const xlsx = `/tmp/v13_${xDl.suggestedFilename()}`; await xDl.saveAs(xlsx);
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(xlsx);
const blaetter = wb.worksheets.map(w => w.name);
check(!blaetter.includes('KD_Pruefung') && !blaetter.includes('Pruefung'), 'Excel ohne KD_Pruefung/Pruefung: ' + blaetter.join(', '));
check(String(wb.getWorksheet('Dashboard').getCell('A1').value).startsWith('Finanzplan – Gründungszuschuss'), 'Excel-Dashboard-Titel nach Zweck');

// ---------- 4. Umschalten mit Datenerhalt ----------
await page.getByTestId('zweck-aendern').click();
const zd = page.getByTestId('zweck-dialog'); await zd.waitFor();
await zd.getByTestId('zweck-md').click();
await zd.getByRole('button', { name: 'Fertig' }).click();
check(await page.locator('.card.kd').isVisible() && (await page.locator('.step-head h2').innerText()) === 'Ergebnis & KD-Prüfung', 'Mikrodarlehen angehakt → KD-Prüfung wieder da');
check((await page.locator('.kd-kpis').innerText()).includes('Kapitaldienst Darlehen 1'), 'Mikrodarlehen-Daten (25.000 €) wieder gerechnet');
check(await page.getByTestId('kd-status').isVisible(), 'Ergebnis „nicht aktuell bestätigt“ nach Zweckwechsel');
await zuSchritt('Finanzierung');
check(await page.locator('.card', { hasText: 'Darlehen 1 –' }).first().isVisible(), 'Mikrodarlehen-Karte wieder sichtbar');
// ⋯-Menü: wieder nur GZ
await page.locator('details.menu summary').click();
await page.getByTestId('menu-zweck').click();
await zd.waitFor(); await zd.getByTestId('zweck-md').click(); await zd.getByRole('button', { name: 'Fertig' }).click();
check(!(await page.getByTestId('side-kd').count()), 'über ⋯-Menü wieder abgewählt');

// ---------- 5. Nur Schätzung: weich ----------
await page.getByTestId('zweck-aendern').click(); await zd.waitFor();
await zd.getByTestId('zweck-orientierung').click(); await zd.getByTestId('zweck-gz').click(); await zd.getByRole('button', { name: 'Fertig' }).click();
await zuSchritt('Liquidität'); await setzeZahl('Barmittel / Einlage Betrag', 0);
check(await page.getByTestId('side-liq-warnung').isVisible() && !(await page.getByTestId('side-liq-fehler').count()), 'Schätzung: negative Liquidität nur als Hinweis');
await durchlaufen(); // Liquidität und Steuern erneut abschließen (Warnung blockiert nicht)
check(!(await page.getByTestId('ergebnis-bestaetigen').isDisabled()), 'Schätzung: Liquidität abschließbar, Ergebnis trotzdem bestätigbar');
// Antrag (GZ) wieder an → Fehler
await page.getByTestId('zweck-aendern').click(); await zd.waitFor(); await zd.getByTestId('zweck-gz').click(); await zd.getByRole('button', { name: 'Fertig' }).click();
check(await page.getByTestId('side-liq-fehler').isVisible() && await page.getByTestId('ergebnis-bestaetigen').isDisabled(), 'mit Gründungszuschuss: Liquiditätsfehler blockiert');

// ---------- 6. Import einer alten Datei (v1.2, ohne Planzweck) ----------
const alt = new ExcelJS.Workbook(); await alt.xlsx.readFile(xlsx);
const d = alt.getWorksheet('_daten');
let json = ''; for (let r = 10; d.getCell(r, 1).value; r++) json += String(d.getCell(r, 1).value);
const plan = JSON.parse(json); delete plan.zweck; delete plan.meta.zweckErgaenzt; plan.schemaVersion = 1;
const neu = JSON.stringify(plan);
for (let r = 10; d.getCell(r, 1).value; r++) d.getCell(r, 1).value = null;
for (let i = 0, r = 10; i < neu.length; i += 30000, r++) d.getCell(r, 1).value = neu.slice(i, i + 30000);
d.getCell('A2').value = 1; d.getCell('A3').value = '1.2.0'; d.getCell('A5').value = crypto.createHash('sha256').update(neu).digest('hex');
const zeilen = []; for (let r = 2; d.getCell(r, 3).value; r++) zeilen.push([3, 4, 5, 6, 7].map(c => d.getCell(r, c).value));
const ohne = zeilen.filter(z => !String(z[2]).startsWith('zweck.'));
zeilen.forEach((_, i) => [3, 4, 5, 6, 7].forEach(c => (d.getCell(i + 2, c).value = null)));
ohne.forEach((z, i) => z.forEach((v, k) => (d.getCell(i + 2, k + 3).value = v)));
await alt.xlsx.writeFile('/tmp/v13_alt_v12.xlsx');
await page.getByTestId('import-input').setInputFiles('/tmp/v13_alt_v12.xlsx');
const idlg = page.getByRole('dialog', { name: 'Import bestätigen' }); await idlg.waitFor();
check(await idlg.getByTestId('import-zweck-hinweis').isVisible(), 'Import-Dialog: Hinweis „ältere Version, Mikrodarlehen voreingestellt“');
check(!(await idlg.innerText()).includes('Prüfsumme'), 'Prüfsumme ok');
await idlg.getByRole('button').last().click();
await page.waitForFunction(() => document.querySelector('[data-testid=side-zweck]')?.textContent?.includes('Mikrodarlehen'));
check((await page.getByTestId('side-zweck').innerText()).includes('Mikrodarlehen') && await page.getByTestId('side-kd').isVisible(), 'alte Datei → Planzweck Mikrodarlehen');
await page.getByTestId('zweck-aendern').click(); await zd.waitFor();
check(await zd.getByTestId('zweck-altdatei').isVisible(), 'Zweck-Dialog zeigt Hinweis zur alten Datei');
await zd.getByRole('button', { name: 'Fertig' }).click();

// ---------- 7. Einführung passt sich an ----------
await page.locator('.topbar').getByRole('button', { name: 'Einführung', exact: true }).click();
await tutorial.waitFor();
const t1 = await folienTitel();
check(t1.includes('Was ist Kapitaldienstfähigkeit?'), `Einführung mit Mikrodarlehen: ${t1.length} Folien`);
await page.keyboard.press('Escape');
check(!(await tutorial.count()), 'Einführung per Escape geschlossen');

check(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
log('E2E v1.3 fertig');
