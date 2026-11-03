// E2E v1.1: „Bitte prüfen“, Plausibilitätshinweise, Hilfe-Tooltips, Szenarien, Stundensatz, PDF-Download, negative Liquidität als Fehler, Screenshots v11_*
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const URL = process.env.APP_URL || 'http://localhost:4173/thex-finanzplan/';
const OUT = '../screenshots';
const log = (...a) => console.log('•', ...a);
const check = (c, msg) => { if (!c) throw new Error('FEHLER: ' + msg); log('ok –', msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', d => d.accept());
const ruhig = () => page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
const kfzZeile = () => page.locator('tr', { has: page.getByLabel('Kfz-Kosten (betrieblich) M1', { exact: true }) });
const nav = t => page.locator('nav.sidebar button', { hasText: t }).first().click();

await page.goto(URL);
await page.getByRole('dialog', { name: 'Einführung' }).waitFor();
await page.keyboard.press('Escape').catch(() => {});
if (await page.getByRole('dialog', { name: 'Einführung' }).isVisible()) { while (await page.getByRole('button', { name: 'Weiter' }).isVisible()) await page.getByRole('button', { name: 'Weiter' }).click(); await page.getByRole('button', { name: "Los geht's" }).click(); }
check(await page.locator('.wordmark').innerText() === 'ThEx Finanzplan', 'Wortmarke „ThEx Finanzplan“');
await page.getByRole('button', { name: 'Beispielprojekt laden' }).click();
for (let i = 0; i < 12; i++) {
  const h = await page.locator('.step-head h2').innerText();
  if (h.startsWith('Ergebnis')) break;
  await page.locator('.step-foot .btn.primary').click();
  await page.waitForFunction(old => document.querySelector('.step-head h2')?.textContent !== old || document.querySelector('[role=alert]'), h);
  if (await page.getByRole('alert').isVisible().catch(() => false)) throw new Error('Validierungsfehler in ' + h);
}
await page.locator('.dashboard').waitFor();
check((await page.getByTestId('ergebnis-status').innerText()).includes('noch nicht bestätigt'), 'Dashboard: Ergebnis noch nicht bestätigt');
await page.getByTestId('ergebnis-bestaetigen').click();
check((await page.getByTestId('ergebnis-status').innerText()).includes('bestätigt am'), 'Ergebnis bestätigt');
check((await page.getByTestId('side-kd-status').innerText()).includes('bestätigt'), 'Seitenleiste: KD bestätigt');
await ruhig();
await page.screenshot({ path: `${OUT}/v11_dashboard_bestaetigt.png` });

// --- Hilfe-Tooltip + Orientierungswerte (Private Kosten) ---
await nav('Private Kosten');
const tip = page.locator('tr', { hasText: 'Miete / Hausgeld' }).locator('.tip').first();
await tip.focus();
const tipText = await tip.getAttribute('data-tip');
check(/Quelle: Vorlage V107/.test(tipText) && /Orientierungswert \(unverbindlich\)/.test(tipText), 'Tooltip mit Vorlagen-Hilfe und Orientierungswert');
check(await page.locator('.orient').count() >= 5, `Orientierungswerte sichtbar (${await page.locator('.orient').count()})`);
await ruhig();
await page.screenshot({ path: `${OUT}/v11_hilfe_tooltip.png` });

// --- Änderung früherer Eingabe → „bitte prüfen“ ---
const miete = page.getByLabel('Miete / Hausgeld Jahr 1');
await miete.fill('750'); await miete.press('Enter');
await page.waitForSelector('nav.sidebar li.pruefen');
const pr = await page.locator('nav.sidebar li.pruefen').allInnerTexts();
check(pr.length >= 7, `Folgeschritte markiert „bitte prüfen“ (${pr.length})`);
check(!(await page.getByTestId('nav-privat').getAttribute('class')).includes('pruefen'), 'geänderter Schritt selbst nicht markiert');
check((await page.getByTestId('side-kd-status').innerText()).includes('nicht aktuell bestätigt'), 'KD-Ampel: „nicht aktuell bestätigt“');
await nav('Umsatzplanung');
await page.getByTestId('pruefen-box').waitFor();
check((await page.getByTestId('pruefen-box').innerText()).includes('Private Kosten'), 'Prüfen-Banner nennt „Private Kosten“');
await ruhig();
await page.screenshot({ path: `${OUT}/v11_bitte_pruefen.png` });
await page.locator('.step-foot .btn.primary').click(); // Prüfen und weiter
await page.waitForFunction(() => !document.querySelector('[data-testid=nav-umsatz]')?.className.includes('pruefen'));
log('ok – Umsatzplanung nach „Prüfen und weiter“ nicht mehr markiert');
await nav('Ergebnis');
check((await page.getByTestId('kd-status').innerText()).includes('nicht aktuell bestätigt'), 'Dashboard-KD-Karte: nicht aktuell bestätigt');
const hin = await page.getByTestId('dashboard-hinweise').innerText();
check(/bitte prüfen/i.test(hin), 'Dashboard-Hinweise listen „Bitte prüfen“');
check(await page.getByTestId('ergebnis-bestaetigen').isDisabled(), 'Bestätigen gesperrt, solange Pflichtschritte zu prüfen sind');
await ruhig();
await page.screenshot({ path: `${OUT}/v11_dashboard_nicht_aktuell.png`, fullPage: false });
// alle markierten Schritte prüfen
for (let i = 0; i < 12; i++) {
  const li = page.locator('nav.sidebar li.pruefen.pflicht').first();
  if (!(await li.count())) break;
  await li.locator('button').click();
  await page.locator('.step-foot .btn.primary').click();
  await page.waitForTimeout(150);
}
await nav('Ergebnis');
await page.getByTestId('ergebnis-bestaetigen').click();
check((await page.getByTestId('ergebnis-status').innerText()).includes('bestätigt am'), 'nach Prüfung erneut bestätigt');

// --- Plausibilität inline: Kfz-Kosten entfernen (Beispiel hat ein Service-Fahrzeug) ---
await nav('Betriebliche Kosten');
const kfz = page.getByLabel('Kfz-Kosten (betrieblich) M1', { exact: true }); await kfz.fill('0'); await kfz.press('Enter');
await kfzZeile().getByRole('button', { name: 'M1 → alle' }).click();
await page.getByTestId('hinweise-kosten').waitFor();
check((await page.getByTestId('hinweise-kosten').innerText()).includes('Fahrzeug geplant'), 'Inline-Hinweis „Fahrzeug ohne Kfz-Kosten“');
await ruhig();
await page.getByTestId('hinweise-kosten').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/v11_hinweis_inline.png` });
// Anlauf entfernen → voller Umsatz ab M1
await nav('Umsatzplanung');
for (const m of [1, 2]) { const f = page.getByLabel(`Faktor ${m}`, { exact: true }); if (await f.count()) { await f.fill('100'); await f.press('Enter'); } }
await nav('Ergebnis');
const hin2 = await page.getByTestId('dashboard-hinweise').innerText();
check(/plausibilität/i.test(hin2) && hin2.includes('Fahrzeug geplant'), 'Dashboard listet Plausibilitätshinweise');
const jump = page.getByTestId('dashboard-hinweise').locator('li', { hasText: 'Fahrzeug geplant' }).getByRole('button');
await ruhig();
await page.getByTestId('dashboard-hinweise').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/v11_dashboard_hinweise.png` });
await jump.click();
check((await page.locator('.step-head h2').innerText()) === 'Betriebliche Kosten', 'Sprunglink führt zum Schritt');
await page.getByLabel('Kfz-Kosten (betrieblich) M1', { exact: true }).fill('180');
await page.getByLabel('Kfz-Kosten (betrieblich) M1', { exact: true }).press('Enter');
await kfzZeile().getByRole('button', { name: 'M1 → alle' }).click();

// --- Szenarien ---
await nav('Szenarien');
const pruefVorher = await page.locator('nav.sidebar li.pruefen').count();
const vorher = await page.evaluate(() => localStorage.length && Object.values(localStorage).join('').length);
await page.getByRole('button', { name: 'Stresstest' }).click();
const sz = await page.getByTestId('sz-ergebnis').innerText();
check((await page.getByTestId('sz-umsatz-wert').innerText()) === '-30 %' && (await page.getByTestId('sz-kosten-wert').innerText()) === '+15 %', 'Preset Stresstest setzt Regler');
log('Stresstest:', sz.replace(/\n/g, ' | '));
check(/Fehler im Szenario/.test(await page.getByTestId('sz-fehler').innerText()), 'Stresstest: negative Liquidität als „Fehler im Szenario“');
check(!(await page.getByTestId('fehler-plan').count()) && !(await page.locator('nav.sidebar li.fehler').count()), 'Szenario-Fehler sperrt den Basisplan nicht');
await page.getByLabel('Umsatz', { exact: true }).fill('-20');
check((await page.getByTestId('sz-umsatz-wert').innerText()) === '-20 %', 'Regler Umsatz -20 %');
const nachher = await page.evaluate(() => localStorage.length && Object.values(localStorage).join('').length);
check(vorher === nachher, 'Szenario verändert gespeicherten Plan nicht');
check((await page.locator('nav.sidebar li.pruefen').count()) === pruefVorher, `Szenario löst kein zusätzliches „bitte prüfen“ aus (${pruefVorher} Markierungen aus den Kosten-/Umsatzänderungen bleiben)`);
await ruhig();
await page.screenshot({ path: `${OUT}/v11_szenarien.png`, fullPage: true });

// --- Stundensatz ---
await nav('Stundensatz');
const satz = await page.getByTestId('std-satz').innerText(), diff = await page.getByTestId('std-diff').innerText();
log('Stundensatz erforderlich', satz, '· Differenz', diff);
check(/\d/.test(satz) && /\d/.test(diff), 'Stundensatz-Rückwärtsrechnung und Vergleich');
await ruhig();
await page.screenshot({ path: `${OUT}/v11_stundensatz.png`, fullPage: true });

// --- PDF ---
await nav('Ergebnis');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF für TAB' }).first().click()]);
const pdf = `/tmp/${dl.suggestedFilename()}`; await dl.saveAs(pdf);
const kopf = fs.readFileSync(pdf).subarray(0, 5).toString();
check(kopf === '%PDF-' && /^Finanzplan_Muster_Werkstatt_TAB_\d{4}-\d{2}-\d{2}\.pdf$/.test(dl.suggestedFilename()), `PDF-Download ${dl.suggestedFilename()} (${fs.statSync(pdf).size} Bytes)`);
const txt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
for (const s of ['Muster Werkstatt', 'Kennzahlen', 'Rentabilitätsvorschau', 'Kapitalbedarf und Finanzierung', 'Darlehen', 'Rechenweg', 'KD-Grenze', 'Liquiditätsplan', 'Hinweise und Plausibilitätsprüfung', 'Seite 1 von']) check(txt.includes(s), `PDF enthält „${s}“`);
fs.copyFileSync(pdf, '/tmp/e2e_tab.pdf');
await ruhig();

// --- Negative Liquidität = Fehler ---
await nav('Liquidität & Eigenmittel');
const bar = page.getByLabel('Barmittel / Einlage Betrag', { exact: true });
await bar.fill('0'); await bar.press('Enter');
const priv = page.getByLabel('Privatdarlehen Betrag', { exact: true });
if (await priv.count()) { await priv.fill('0'); await priv.press('Enter'); }
await page.getByTestId('fehler-liquiditaet').waitFor();
const fl = await page.getByTestId('fehler-liquiditaet').innerText();
check(/Liquidität negativ in \d+ von 36 Monaten/.test(fl) && /nicht einreichungsfähig/.test(fl), 'Liquidität: roter Fehler inline');
check(await page.locator('[data-testid=nav-liquiditaet].fehler').count() === 1, 'Seitenleiste: Liquidität als Fehler markiert');
check(/nicht einreichungsfähig/.test(await page.getByTestId('side-liq-fehler').innerText()), 'Seitenleiste KD-Bereich: nicht einreichungsfähig');
await page.locator('.step-foot .btn.primary').click();
check((await page.locator('.step-head h2').innerText()) === 'Liquidität & Eigenmittel' && /Liquidität negativ/.test(await page.locator('.errors[role=alert]').innerText()), 'Schritt Liquidität kann nicht abgeschlossen werden');
await ruhig();
await page.getByTestId('fehler-liquiditaet').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/v11_liquiditaet_fehler.png` });
await nav('Ergebnis');
check(/nicht einreichungsfähig/.test(await page.getByTestId('fehler-plan').innerText()), 'Dashboard: Fehlerbox');
check(/Liquidität negativ/.test(await page.getByTestId('kd-liq-fehler').innerText()), 'KD-Bereich: Liquiditätsfehler');
check(await page.getByTestId('ergebnis-bestaetigen').isDisabled() && (await page.getByTestId('bestaetigen-gesperrt').count()) === 1, '„Ergebnis bestätigen“ gesperrt');
check(/fehler/i.test(await page.getByTestId('dashboard-hinweise').innerText()), 'Dashboard-Hinweise: Fehler-Eintrag');
await ruhig();
await page.screenshot({ path: `${OUT}/v11_dashboard_liq_fehler.png` });
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF für TAB' }).first().click()]);
const pdf2 = `/tmp/${dl2.suggestedFilename()}`; await dl2.saveAs(pdf2);
const txt2 = execFileSync('pdftotext', ['-layout', pdf2, '-']).toString();
check(/_NICHT_EINREICHUNGSFAEHIG\.pdf$/.test(dl2.suggestedFilename()) && /FEHLER: Plan nicht einreichungsfähig/.test(txt2) && /NICHT EINREICHUNGSFÄHIG/.test(txt2), `PDF markiert Fehler (${dl2.suggestedFilename()})`);
execFileSync('pdftoppm', ['-png', '-r', '70', '-f', '1', '-l', '1', '-singlefile', pdf2, `${OUT}/v11_pdf_fehler_seite1`]);
await bar.isVisible().catch(() => {});
await nav('Liquidität & Eigenmittel');
await page.getByLabel('Barmittel / Einlage Betrag', { exact: true }).fill('4000'); await page.getByLabel('Barmittel / Einlage Betrag', { exact: true }).press('Enter');
check(!(await page.getByTestId('fehler-liquiditaet').count()), 'Fehler verschwindet nach Korrektur');

// --- Impressum / Datenschutz entfernt ---
check(!(await page.locator('footer.footer a', { hasText: /Impressum|Datenschutz/ }).count()) && !(await page.getByText(/Impressum|Datenschutz/).count()), 'kein Impressum/Datenschutz in der App');

// Netzwerk: keine externen Requests
const extern = [];
const p2 = await ctx.newPage(); p2.on('request', r => { if (!r.url().startsWith('http://localhost')) extern.push(r.url()); });
await p2.goto(URL); await p2.waitForTimeout(800);
check(extern.length === 0, 'keine externen Requests (Tracking/CDN)');
const cookies = await ctx.cookies(); check(cookies.length === 0, 'keine Cookies');

if (errors.length) { console.log('Browser-Fehler:', errors); process.exitCode = 1; }
await browser.close();
log('E2E v1.1 fertig');
