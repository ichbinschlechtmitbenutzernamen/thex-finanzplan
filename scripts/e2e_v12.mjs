// E2E v1.2: Reset-Button (Dialog, Abbrechen, Vorher sichern, Zurücksetzen) – Screenshot v12_reset_dialog.png
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.APP_URL || 'http://localhost:4173/thex-finanzplan/';
const OUT = '../screenshots';
const KEY = 'thex-finanzplan:v1';
const log = (...a) => console.log('•', ...a);
const check = (c, msg) => { if (!c) throw new Error('FEHLER: ' + msg); log('ok –', msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
const ruhig = () => page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
const tutorialWeg = async () => {
  const t = page.getByRole('dialog', { name: 'Einführung' });
  await t.waitFor();
  await page.keyboard.press('Escape').catch(() => {});
  if (await t.isVisible()) { for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Weiter' }).click(); await page.getByRole('button', { name: "Los geht's" }).click(); }
};
const gespeichert = () => page.evaluate(k => localStorage.getItem(k), KEY);

await page.goto(URL);
await tutorialWeg();
check((await page.locator('footer.footer').innerText()).includes('1.2.0'), 'Version 1.2.0');
await page.getByRole('button', { name: 'Beispielprojekt laden' }).click();
for (let i = 0; i < 12; i++) {
  const h = await page.locator('.step-head h2').innerText();
  if (h.startsWith('Ergebnis')) break;
  await page.locator('.step-foot .btn.primary').click();
  await page.waitForFunction(old => document.querySelector('.step-head h2')?.textContent !== old, h);
}
await page.getByTestId('ergebnis-bestaetigen').click();
check((await gespeichert()).includes('Muster Werkstatt'), 'Muster Werkstatt geladen, abgeschlossen und bestätigt');
await ruhig();

// Dialog öffnen (Seitenleiste) und Abbrechen
await page.getByTestId('reset-oeffnen').click();
const dlg = page.getByTestId('reset-dialog');
await dlg.waitFor();
const txt = await dlg.innerText();
check(/Alle Eingaben werden unwiderruflich gelöscht/.test(txt) && txt.includes('Muster Werkstatt'), 'Bestätigungsdialog erklärt das Löschen');
check(await page.getByRole('button', { name: 'Abbrechen' }).evaluate(b => b === document.activeElement), 'Fokus liegt auf „Abbrechen“ (kein versehentliches Löschen per Enter)');
await page.screenshot({ path: `${OUT}/v12_reset_dialog.png` });
await page.getByRole('button', { name: 'Abbrechen' }).click();
check(!(await dlg.count()), 'Dialog geschlossen');
check((await page.locator('.topbar .proj').innerText()).includes('Muster Werkstatt') && (await gespeichert()).includes('Muster Werkstatt') && await page.locator('nav.sidebar li.done').count() > 5, 'Abbrechen behält alle Daten');
// Escape schließt ebenfalls
await page.getByTestId('reset-oeffnen').click(); await dlg.waitFor(); await page.keyboard.press('Escape');
check(!(await dlg.count()), 'Escape schließt den Dialog ohne Löschen');

// Über das Menü öffnen, vorher sichern, dann zurücksetzen
await page.locator('details.menu summary').click();
await page.locator('details.menu').getByRole('button', { name: 'Alles zurücksetzen …', exact: true }).click();
await dlg.waitFor();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Vorher als Excel sichern' }).click()]);
const datei = `/tmp/${dl.suggestedFilename()}`; await dl.saveAs(datei);
await page.getByTestId('reset-gesichert').waitFor();
check(fs.statSync(datei).size > 10000 && /Muster_Werkstatt/.test(dl.suggestedFilename()), `Sicherung vor dem Reset: ${dl.suggestedFilename()}`);
await page.getByRole('button', { name: 'Ja, alles löschen' }).click();
await page.getByRole('dialog', { name: 'Einführung' }).waitFor();
check((await gespeichert()) === null, 'localStorage-Plandaten gelöscht');
log('ok – Einführung wird erneut angezeigt');
await tutorialWeg();
check((await page.locator('.topbar .proj').innerText()).startsWith('Neuer Plan'), 'Kopfzeile: „Neuer Plan“');
check((await page.locator('.step-head h2').innerText()) === 'Start & Einstellungen', 'zurück bei Schritt 0');
const n = await page.locator('nav.sidebar li').count(), gesperrt = await page.locator('nav.sidebar li.locked').count();
check(gesperrt === n - 1 && !(await page.locator('nav.sidebar li.done, nav.sidebar li.pruefen').count()), `alle Schritte außer Start gesperrt (${gesperrt}/${n}), keine Häkchen/Markierungen`);
check((await page.getByTestId('side-kd').innerText()).trim() === '–', 'KD-Ampel leer');
check(await page.getByRole('button', { name: 'PDF für TAB' }).isDisabled(), 'PDF gesperrt');
// Neustart der Seite: weiterhin leer; Re-Import der Sicherung stellt den Plan wieder her
await page.reload(); await page.locator('.topbar .proj').waitFor();
check((await page.locator('.topbar .proj').innerText()).startsWith('Neuer Plan'), 'nach Neuladen weiterhin leer');
await page.getByTestId('import-input').setInputFiles(datei);
await page.getByRole('dialog', { name: 'Import bestätigen' }).waitFor();
await page.getByRole('dialog', { name: 'Import bestätigen' }).getByRole('button').last().click();
await page.waitForFunction(() => document.querySelector('.topbar .proj')?.textContent?.includes('Muster Werkstatt'));
log('ok – Sicherung lässt sich wieder importieren');
check(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
log('E2E v1.2 fertig');
