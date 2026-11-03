# ThEx Finanzplan – Web-App

Ein geführter Finanzplan für Gründer (TAB Thüringer Mikrodarlehen), entwickelt auf Basis der Vorlage „2026_Vorlage_Finanzplanung_ThEx_V107.xlsm“.

Die App ist rein statisch und hat kein Backend. Alle Eingaben bleiben im Browser (localStorage) und können als Excel-Datei exportiert und wieder importiert werden.

## Lokal starten
```bash
npm ci
npm run dev        # Entwicklungsserver: http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run build      # Produktionsbuild nach dist/
npm run preview    # gebaute App unter http://localhost:4173/thex-finanzplan/
node scripts/e2e.mjs   # Browser-Test inkl. Export/Import und Screenshots (Preview muss laufen)
node scripts/e2e_v11.mjs   # Browser-Test v1.1: bitte prüfen, Hinweise, Szenarien, Stundensatz, PDF, Liquiditätsfehler
node scripts/e2e_v12.mjs   # Browser-Test v1.2: Alles zurücksetzen (Dialog, Abbrechen, Sicherung, Reset)
node scripts/e2e_v13.mjs   # Browser-Test v1.3: Planzweck, leerer Plan ohne Liquiditätsfehler, Umschalten, Import alter Dateien
npx vite-node scripts/beispiel-pdf.ts ../beispiel_tab.pdf   # Beispiel-PDF für die TAB erzeugen
```

## Projektstruktur
* `src/model`: Datentypen, Parameter 2026 (`defaults.ts`) und der Beispielplan
* `src/calc`: Rechenkern (Steuern, Darlehen, RentaV, Liquidität, KD-Prüfung)
* `src/io`: localStorage sowie Excel-Export und -Import (ExcelJS). Das versteckte Blatt `_daten` enthält JSON, Mapping und Prüfsumme.
* `src/ui`: Schritte, Dashboard, Tutorial, Diagramme
* `ABWEICHUNGEN.md`: Abgleich mit der Excel-Vorlage

## Veröffentlichen auf GitHub Pages
1. Auf GitHub ein Repository anlegen, Vorschlag: **`thex-finanzplan`**. Öffentlich genügt für kostenloses Pages; bei privaten Repos ist ein bezahlter Plan nötig.
2. Den **Inhalt dieses Ordners `app/`** als Repository-Wurzel pushen, damit `.github/workflows/deploy.yml` gefunden wird:
   ```bash
   git init && git add . && git commit -m "ThEx Finanzplan v1.0"
   git branch -M main
   git remote add origin https://github.com/<konto>/thex-finanzplan.git
   git push -u origin main
   ```
3. Im Repository unter *Settings → Pages → Build and deployment → Source* **„GitHub Actions“** wählen.
4. Bei jedem Push auf `main` läuft der Workflow: Tests, Build und Veröffentlichung. Adresse: `https://<konto>.github.io/thex-finanzplan/`.

`vite.config.ts` nutzt `base: '/thex-finanzplan/'`. Bei anderem Repo-Namen oder eigener Domain muss dieser Pfad angepasst werden.

## Parameter jährlich aktualisieren
Alle Steuer- und SV-Werte stehen in `src/model/defaults.ts` (`PARAMS_2026`), z. B. Tarifzonen, BBG, Beitragssätze und Hebesatz. Nach einer Änderung `npm test` ausführen. Einzelne Testwerte müssen dann eventuell angepasst werden.

## Version 1.1
* **„Bitte prüfen“:** Jeder abgeschlossene Schritt speichert eine Prüfsumme seiner Vorgängerdaten (`meta.stand`). Ändern sich frühere Angaben, werden Folgeschritte markiert. KD-Ampel und Dashboard zeigen dann „nicht aktuell bestätigt“, bis das Ergebnis erneut bestätigt wird (`src/model/schritte.ts`).
* **Hilfe-Tooltips:** 48 Zellkommentare und die Textfelder aus 9 Blättern der Vorlage V107, ohne Autorennamen. Dazu kommen unverbindliche **Orientierungswerte** (`src/model/hilfe.ts`).
* **Plausibilitätshinweise:** Sie blockieren nichts und erscheinen inline und auf dem Dashboard mit Sprunglinks. Geprüft werden:
  * voller Umsatz ab Monat 1
  * Entnahme unter Minimum oder unter den privaten Kosten
  * Fahrzeug ohne Kfz-Kosten
  * Finanzierungslücke
  * Nullwerte
  * KD gelb oder rot
  * Umsatzsprung J1→J2
* **Negative Liquidität ist ein Fehler** (kein Hinweis): Sobald im Basisplan ein Monat unter 0 € liegt, gilt:
  * roter Fehler im Schritt Liquidität, auf dem Dashboard und im KD-Bereich
  * der Schritt Liquidität kann nicht abgeschlossen und das Ergebnis nicht bestätigt werden
  * PDF (Deckblatt, Liquiditätsseite, Fußzeile jeder Seite, Dateiname) und Excel-Dashboard markieren den Plan als „nicht einreichungsfähig“
  * in den Szenarien erscheint „Fehler im Szenario“, der Basisplan wird dadurch nicht gesperrt
  * das Beispiel „Muster Werkstatt“ hat im Basisfall keine negative Liquidität (Unit-Test)
* **PDF für die TAB** (`src/io/pdf.ts`, jsPDF, wird erst bei Bedarf geladen):
  * Deckblatt und Kennzahlen
  * Rentabilität J1–3, Kapitalbedarf/Finanzierung, Darlehen
  * KD-Rechenweg mit Ampel
  * Liquidität (Jahr, Monat, Quartal, Diagramm)
  * Stundensatz
  * Hinweise
* **Szenarien:** Regler für Umsatz und Kosten (±50 %) und fünf Voreinstellungen. Die Auswirkung auf KD, Liquiditätstiefpunkt und Betriebsergebnis wird live angezeigt, ohne die Eingaben zu verändern. Der Umsatzpuffer wird bis zur roten Ampel berechnet.
* **Stundensatz:** Der nötige Satz wird rückwärts aus Kosten, Privatbedarf, Steuern und Tilgung berechnet und mit dem geplanten Satz verglichen.
* **Branding:** Wortmarke „ThEx Finanzplan“ in den ThEx-Farben. Impressum und Datenschutzerklärung sind vorerst nicht enthalten.

### Quelle der Farben (abgerufen am 02.11.2026)
* Farben: https://thex.de/assets/css/style.css (#0089C1, #005274, #C9D30E, #1f384d, #f18c00). Das Logo wird nicht übernommen, die App nutzt nur eine Text-Wortmarke.

## Version 1.2

- **Alles zurücksetzen:** Button in der Seitenleiste (unten) und im Menü „⋯“. Ein Bestätigungsdialog erklärt, was gelöscht wird, und bietet „Vorher als Excel sichern“ an; der Fokus liegt auf „Abbrechen“. Beim Zurücksetzen werden alle Eingaben, erledigte Schritte, „bitte prüfen“-Markierungen und die Ergebnis-Bestätigung gelöscht, die Browserdaten entfernt; der Plan beginnt wieder bei Schritt 0 mit Einführung.

## Version 1.3

- **Planzweck (Schritt 0, „Wofür erstellen Sie den Finanzplan?“):** Checkboxen mit Mehrfachauswahl, mindestens ein Zweck ist Pflicht:
  - *Erste Schätzung / eigene Orientierung*: weniger streng. Projektname, Namen, private Kosten, PKV-Beitrag und negative Liquidität erscheinen als Hinweise („Für eine erste Schätzung nicht zwingend“), nicht als Fehler. Das gilt nur, solange kein Antragszweck gewählt ist.
  - *Gründungszuschuss (Agentur für Arbeit)*: Kapitalbedarfsplan, Rentabilitätsvorschau (3 Jahre) und Liquiditätsplan mit GZ-Überschriften. PDF „Finanzplan – Gründungszuschuss“ (Dateiname `…_GZ_…`). Hinweis, wenn kein Gründungszuschuss eingetragen ist.
  - *Thüringer Mikrodarlehen (TAB)*: Verhalten wie bis v1.2, mit KD-Prüfung, Mikrodarlehen, Tilgungsplan, Kontoauszugsanalyse und Soll-Ist.
- **Ohne Mikrodarlehen** sind Kontoauszugsanalyse (Prüfer), KD-Berechnung, Mikrodarlehen samt Tilgungsplan und Soll-Ist (Folgedarlehen) ausgeblendet: in Navigation, Freischaltung, Dashboard, Seitenleiste, Szenarien, PDF und Excel (kein Blatt `KD_Pruefung`/`Pruefung`). Sie blockieren nichts; die KD ist dann kein Abschlusskriterium. Die Eingaben bleiben gespeichert und sind beim erneuten Anhaken wieder da. Kapitalbedarf, Finanzierung (weitere Darlehen, Eigenmittel) und Liquidität gibt es bei jedem Zweck.
- Ändern lässt sich der Zweck jederzeit: in der Seitenleiste („Planzweck … ändern“), im Menü „⋯“ oder in Schritt 0. Ein Wechsel markiert das Ergebnis als „nicht aktuell bestätigt“.
- **Excel:** Der Zweck steht als Eingabe (ja/nein) im Blatt *Projekt* und wird beim Import übernommen. Dateien aus v1.0–v1.2 haben keinen Zweck: Sie werden mit „Mikrodarlehen“ importiert, und der Import-Dialog sowie die Zweck-Auswahl zeigen einen Hinweis. Für ältere Browserdaten gilt dasselbe (Schema-Version 2).
- „Alles zurücksetzen“ setzt auch den Zweck zurück. Die Einführung fragt den Zweck ab und blendet je nach Zweck eigene Folien ein (Schätzung, Gründungszuschuss, KD).
- **Liquiditätsfehler bei leerem Plan behoben:** Ein leerer Plan zeigte „−10.290 €“. Ursache: Für gesetzlich Versicherte rechnet die App den KV/PV-Mindestbeitrag (Mindestbemessung 1.318,33 €/Monat × 21,7 % ≈ 286 €/Monat, 3.432,93 €/Jahr) als Privatentnahme, auch ohne Umsatz. Über 36 Monate sind das −10.298,79 €. Die Rechnung bleibt unverändert. Der Fehler wird außerhalb von Schritt 8 (Seitenleiste, Dashboard, PDF, Excel) aber erst gemeldet, wenn er aussagekräftig ist: sobald Finanzierung oder Liquidität abgeschlossen sind oder das Ergebnis bestätigt wurde, oder sobald Umsatz und Kosten erfasst sind und zusätzlich Kosten abgeschlossen oder eine Finanzierung eingetragen ist. Vorher steht in der Seitenleiste „Liquidität: wird geprüft, sobald …“. In Schritt 8 und bei der Ergebnis-Bestätigung bleibt der Fehler blockierend (außer im Zweck „nur erste Schätzung“).
- Datenmodell: `Plan.zweck` (TypeScript-Typ + Migration in `io/storage.ts`). Zod ist im Projekt nicht im Einsatz, daher gibt es kein Zod-Schema.
- Tests: `src/__tests__/v13.test.ts` (Vitest) und `scripts/e2e_v13.mjs` (Playwright).

