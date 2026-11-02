# Abgleich Web-App ↔ Vorlage V107

Stand: 02.11.2026. Grundlage ist der Beispielplan „Muster Werkstatt“ (`src/model/beispiel.ts`).

## Vorgehen
Die gleichen Eingaben wurden per Skript in eine Kopie der Vorlage geschrieben:
* Gründung 01/2027
* 2 Geschäftsfelder mit 24 Monatsmengen und Anlauffaktor 0,6 / 0,8 / 1
* Materialquoten 10 % / 45 %
* 11 Kostenpositionen mit zusammen 1.490 €/Monat
* 4 Investitionen mit ND 120 / 84 / 36 / 1 Monat
* Mikrodarlehen 25.000 € über 7 Jahre, davon 1 Jahr tilgungsfrei, 2,4 %
* Abgabenrechner-Gewinn = Jahresergebnis J1/J2/J3

Danach wurde die Kopie mit LibreOffice headless neu berechnet und verglichen. Die Vorlage und die Abgleich-Skripte sind nicht Teil dieses Repositorys.

## Ergebnis: Übereinstimmung, wo die Vorlage korrekt rechnet

| Größe | J1 | J2 | J3 | Abweichung |
|---|---|---|---|---|
| Umsatz | 57.997 | 98.820 | 103.761 | 0,00 € (auch monatlich) |
| Material | 13.351,30 | 22.986,00 | 24.135,30 | 0,00 € |
| AfA | 2.850 | 2.100 | 2.100 | 0,00 € |
| Zinsen Mikrodarlehen | 600,00 | 554,17 | 454,17 | 0,00 € |
| Sonstige Kosten (+3 % p. a.) | 17.880,00 | 18.416,40 | 18.968,89 | 0,00 € |
| Betriebsergebnis | 19.715,70 | 54.763,43 | 58.102,64 | J1 −3.600 € (siehe 1.); J2/J3 0,00 € |
| Gewerbesteuer | 0 | 4.967,90 | 5.527,20 | 0,00 € |
| Tilgung ab Monat 13 | – | 347,22 €/Monat | | 0,00 € |

## Bewusste Abweichungen

1. **Einmalige Kosten** (Betriebskosten zum Start und Gründungskosten) sind in der App Aufwand im jeweiligen Monat. Das ist eine fachliche Vorgabe. In der Vorlage fließen sie nicht in die RentaV ein, daher J1 −3.600 €.
2. **KV-Zusatzbeitrag:** Die App nimmt 2,9 % (Durchschnitt 2026, als Parameter änderbar), der Abgabenrechner fest 2,69 % (TK). Für J2 ergibt das KV/PV 11.884 statt 11.769 € und ESt 3.907 statt 3.945 €. Mit 2,69 % rechnet die App identisch; das prüft der Test „ESt 3404 wie Abgabenrechner“.
3. **Mindestbemessung KV:** Die App nutzt 1.318,33 €/Monat als Bemessungsgrundlage, die Vorlage pauschal mindestens 270 € Beitrag. Im Beispiel greift keine der beiden Regeln.
4. **KD-Prüfung:** In der Vorlage ergibt sie für das Beispiel nur 3,8 % Auslastung. Ursachen:
   * Der Kapitaldienst kommt aus dem *Tilgungsplan* mit festen 10.000 € und 2,43 % statt aus dem tatsächlichen Darlehen.
   * AfA und Zinsen werden nicht addiert.
   * Entnahmen gehen nur als Monatswert ohne ×12 ein, und KV/ESt werden nicht abgezogen.

   Die App rechnet nach Spezifikation: Jahr 2, echtes Darlehen, Privatbedarf ×12 inklusive SV und ESt. Ergebnis: Auslastung 22,3 %, KD-Grenze 21.179 €, Kapitaldienst 4.721 €.
5. **Darlehen 2/3 leer → `#DIV/0!`:** In der Vorlage bricht die gesamte RentaV ab Zinsen ab. Für den Abgleich wurde deshalb Laufzeit 1 gesetzt. Die App fängt diesen Fall ab.
6. **Zinssatz:** Die Vorlage beschriftet das Feld mit „effektiv“, rechnet aber wie mit einem Sollzins. Die App fragt den Sollzins ab, der effektive Zins ist nur Info.
7. **Tilgungsfreie Zeit** wird aus den Jahren berechnet. In der Vorlage muss man die Tilgungszellen von Hand auf 0 setzen.
8. **USt auf Investitionen** gilt je Position. Die Vorlage nimmt pauschal 19 % (Liquiditätsplan C69).
9. **36 Monate durchgehend:** Die Vorlage rechnet Jahr 2/3 quartalsweise. Jahressummen sind identisch, Monatswerte in J2/J3 gibt es nur in der App.
10. Weitere behobene Vorlagenfehler wurden bei der Analyse der Vorlage gefunden und in der App vermieden, z. B.:
    * ESt-Zonengrenzen `<`/`>`
    * Diagramm-Hilfstabelle J3
    * Soll-Ist-Formeln
    * Kontoauszugsanalyse

## Nicht abgeglichen
* Liquiditätsplan und USt-Zahllast im Monatsdetail. Die Vorlage hat dort die bekannten Fehler (USt-Zeile D6, 19 % pauschal, Darlehen immer Monat 1), deshalb ist ein 1:1-Vergleich nicht aussagekräftig.
* Personal: Das Beispiel hat kein Personal. Den AG-Anteil decken Unit-Tests ab (21,5 % statt 22 % fest in der Vorlage).

## Ergänzungen in v1.1
* **Stundensatz:** Die Vorlage setzt AfA an. Die App setzt für die Liquiditätssicht die Tilgung an und berücksichtigt die Auslastung. Die Planwerte sind deshalb nicht 1:1 mit der Vorlage vergleichbar.
* **Plausibilitätsschwellen und Orientierungswerte** stammen nicht aus der Vorlage. Es sind eigene, unverbindliche Annahmen, die fachlich bestätigt werden müssen.
* **Szenarien** gibt es in der Vorlage nicht.
