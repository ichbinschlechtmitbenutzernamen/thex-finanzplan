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
