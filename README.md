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
