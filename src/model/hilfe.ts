/**
 * Hilfetexte aus der Vorlage „2026_Vorlage_Finanzplanung_ThEx_V107.xlsm“ (Zellkommentare und Textfelder),
 * redaktionell an die App angepasst (Autorennamen entfernt, „In der App“-Hinweise ergänzt), plus Orientierungswerte.
 *
 * Orientierungswerte sind grobe Erfahrungs-/Richtwerte für Plausibilitätsüberlegungen –
 * KEINE verbindlichen Vorgaben der TAB oder von ThEx. Vor Veröffentlichung fachlich prüfen.
 */
export interface HilfeEintrag {
  /** Hilfetext (aus der Vorlage, sprachlich geglättet) */
  text: string;
  /** Fundstellen in der Vorlage: Blatt!Zelle bzw. Blatt (Textfeld) */
  quellen: string[];
  /** Orientierungswert (unverbindlich) */
  orientierung?: string;
  /** Hinweis, wie die App den Punkt umsetzt (wenn abweichend von der Vorlage) */
  app?: string;
}

export const ORIENTIERUNG_LABEL = 'Orientierungswert – unverbindlich, keine Vorgabe der TAB/ThEx';

export const HILFE = {
  // ---------- Projektdaten ----------
  'projekt.allgemein': { text: 'Bitte tragen Sie hier Ihre Kontaktdaten sowie die Daten Ihres Vorhabens ein. Alle Eingabefelder (in der Vorlage gelb hinterlegt) sind auszufüllen bzw. anzupassen.', quellen: ['Projektdaten (Textfeld)'] },

  // ---------- Private Kosten ----------
  'privat.allgemein': { text: 'Ermitteln Sie die Summe Ihrer laufenden monatlichen privaten Ausgaben. Prüfen Sie, ob Sie die Kosten der gesamten Familie tragen (Alleinverdiener) oder nur Ihre eigenen bzw. einen Anteil, weil Ihr/e Partner/in zum Familieneinkommen beiträgt. Beispiele: Miete bzw. Hausgeld, Lebenshaltung (Nahrungsmittel, Bekleidung …), private Versicherungen, Telekommunikation/Internet, Sparraten. Die empfohlene Liquiditätsrücklage bemisst sich an den monatlichen Kosten und dient als Ausgleich für schwankende Einnahmen.', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'Liquiditätsrücklage privat: ca. 3 Monatskosten' },
  'privat.Miete / Hausgeld': { text: 'Warmmiete oder Hausgeld bzw. Kreditrate für selbst genutztes Wohneigentum (Anteil, den Sie tragen).', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'Single in Thüringen ca. 350–700 €/Monat' },
  'privat.Strom, Heizung, Nebenkosten': { text: 'Abschläge für Strom, Heizung/Gas und nicht in der Miete enthaltene Nebenkosten.', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'ca. 80–200 €/Monat je Haushalt' },
  'privat.Lebensmittel, Drogerie': { text: 'Lebenshaltungskosten, z. B. für Nahrungsmittel und Drogerieartikel.', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'ca. 250–400 € je Erwachsenem/Monat' },
  'privat.Kleidung': { text: 'Durchschnittlicher Monatsbetrag für Bekleidung und Schuhe.', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'ca. 40–100 €/Monat je Person' },
  'privat.Telefon, Internet, Rundfunk': { text: 'Telekommunikation, Internet und Rundfunkbeitrag (privat).', quellen: ['a. Kosten privat (Textfeld)'], orientierung: 'ca. 40–80 €/Monat (Rundfunkbeitrag 18,36 €)' },
  'privat.Freizeit, Urlaub': { text: 'Freizeit, Hobbys, Urlaub – auf den Monat umgerechnet.', quellen: [], orientierung: 'ca. 80–250 €/Monat' },
  'privat.Private Altersvorsorge': { text: 'Bitte Angebote für die Altersvorsorgeplanung einholen. Steuerlich als Vorsorgeaufwand anrechenbar ist der Beitrag zur gesetzlichen Rentenversicherung in voller Höhe; private Altersvorsorgeverträge (Ausnahme Rürup-Rente) und ETF-Sparpläne sind nicht anrechenbar.', quellen: ['a. Kosten privat!A18', 'Abgabenrechner!A22', 'Abgabenlast Kapitalgesellschaft!A29'] },
  'privat.Kfz-Steuer und -Versicherung': { text: 'Monatlicher Durchschnitt für das private Kfz: Kfz-Steuer, Haftpflicht, Voll- bzw. Teilkasko.', quellen: ['a. Kosten privat!A20'], orientierung: 'ca. 40–120 €/Monat' },
  'privat.Treibstoff / Laden': { text: 'Monatlicher Durchschnitt für Treibstoff (Diesel, Benzin, Gas, Strom).', quellen: ['a. Kosten privat!A20'], orientierung: 'ca. 80–200 €/Monat' },
  'privat.Reparatur, Reifen, TÜV': { text: 'Monatlicher Durchschnitt für Reparatur/Instandhaltung, Inspektionen, Ölwechsel, Reifen (Wechsel, Wuchten, Sommer-/Winterräder), Reinigung, Stellplatz/Tiefgarage und TÜV/AU.', quellen: ['a. Kosten privat!A20'], orientierung: 'ca. 40–100 €/Monat' },
  'privat.Sparrate / Rücklage': { text: 'Regelmäßige Sparraten. Eine Rücklage für die Einkommensteuer gehört nicht hierher – sie berechnet die App selbst.', quellen: ['a. Kosten privat (Textfeld)', 'l. Stundensatz-Kalk.!B3'] },
  'privat.est': { text: 'Die Einkommensteuer kann erst nach Ermittlung des Gewinns erfasst werden; den genauen Betrag sollte der begleitende Steuerberater benennen. Die App schätzt sie aus dem geplanten Gewinn (Steuerrücklage).', quellen: ['a. Kosten privat!A27'], app: 'automatisch berechnet' },
  'privat.kv': { text: 'Sätze bitte an den Zusatzbeitrag Ihrer Krankenkasse und an den Pflegesatz mit Kindern anpassen. Private Krankenversicherungen sind bis zur Leistungshöhe der GKV ansetzbar (der ansetzbare Betrag steht meist in der Police).', quellen: ['Abgabenrechner!A18', 'Abgabenlast Kapitalgesellschaft!A25'], orientierung: 'Ø-Zusatzbeitrag GKV 2026: 2,9 %' },
  'privat.grv': { text: 'Der Beitrag zur gesetzlichen Rentenversicherung ist als Vorsorgeaufwand in voller Höhe steuerlich anrechenbar.', quellen: ['Abgabenrechner!A22', 'Abgabenlast Kapitalgesellschaft!A29'] },
  'privat.einnahmen': { text: 'Private Einnahmen (Partner/in, Kindergeld, Miete …) mindern die notwendige Privatentnahme. Eine rechnerisch negative Privatentnahme wäre eine Privateinlage – sie wird nicht angesetzt, die Entnahme ist dann 0.', quellen: ['j. Detail-Liquiditätsplan!B87'] },
  'privat.abgleich': { text: 'Zum Abgleich der geschätzten mit den tatsächlichen Kosten anhand einer Kontoauszugsanalyse. Die Kennzahl zeigt das Verhältnis der aktuellen (tatsächlichen) zu den geplanten privaten Kosten.', quellen: ['a. Kosten privat!A28', 'a. Kosten privat!A37'], orientierung: 'Abweichung bis ca. ±10 % gilt als unauffällig' },

  // ---------- Haushaltsbuch ----------
  'hb.allgemein': { text: 'Betrachten Sie die letzten 12 Kontoauszüge und tragen Sie die Werte ein – beginnend mit dem Kontostand zu Beginn des ältesten Monats. Dann tragen Sie für jeden Monat alle Einzahlungen ein und den Kontostand am Monatsende. Sobald Anfangsbestand, Einzahlungen und Endbestände eingetragen sind, errechnet sich der Rest.', quellen: ['Haushaltsbuch (Textfeld)'] },
  'hb.anfang': { text: 'Monatsanfangsbestand eintragen (Kontostand zu Beginn des ältesten Monats).', quellen: ['Haushaltsbuch!C2'] },
  'hb.ein': { text: 'Zahlungseingänge eintragen und mit „+“ verketten, z. B. 900+600+400.', quellen: ['Haushaltsbuch!D2', 'Haushaltsbuch (Textfeld)'], app: 'Ein führendes „=“ ist in der App nicht nötig (wird aber akzeptiert).' },
  'hb.ende': { text: 'Monatsendbestand eintragen.', quellen: ['Haushaltsbuch!F2'] },

  // ---------- Umsatz ----------
  'umsatz.allgemein': { text: 'Tragen Sie die verschiedenen Geschäftsfelder Ihres Unternehmens ein. Geben Sie je Geschäftsfeld einen Durchschnittspreis (netto) an und planen Sie die Anzahl der Kunden/Verkäufe in den einzelnen Monaten. Mit dem prozentualen Anteil bilden Sie eine Anlaufphase oder Saisonschwankungen ab. Achten Sie auf die richtige Monatsreihenfolge.', quellen: ['c. Umsatzplanung (Textfeld)'], app: 'Die Monatsreihenfolge ergibt sich automatisch aus dem Gründungsmonat; Tageszahlen je Monat müssen nicht eingetragen werden.' },
  'umsatz.faktor': { text: 'Prozentualer Anteil zur Abbildung einer Anlaufphase und von Saisonschwankungen (100 % = volles Niveau).', quellen: ['c. Umsatzplanung (Textfeld)'], orientierung: 'Anlaufphase häufig 30–70 % in den ersten 3–6 Monaten' },
  'umsatz.preis': { text: 'Durchschnittspreis (netto) je Verkauf, Auftrag oder Stunde.', quellen: ['c. Umsatzplanung (Textfeld)'] },
  'umsatz.menge': { text: 'Anzahl der Kunden bzw. Verkäufe im jeweiligen Monat.', quellen: ['c. Umsatzplanung (Textfeld)'] },
  'umsatz.ust': { text: 'Unterliegen Ihre Dienstleistungen/Waren dem vollen (19 %) oder dem ermäßigten Umsatzsteuersatz (7 %)?', quellen: ['h. Detail-RentaV (Textfeld)'] },
  'umsatz.material': { text: 'Mit welchem Materialaufwand bzw. welcher Materialeinsatzquote rechnen Sie? Warenquote = Warenkosten ÷ erzielter Umsatz. Material = eingesetzte Materialien zur Herstellung von Gütern oder zur Produktion von Waren.', quellen: ['h. Detail-RentaV (Textfeld)', 'h. Detail-RentaV!C94', 'i. RentaV-Übersicht!A13'], orientierung: 'Handel ca. 50–70 %, Handwerk ca. 20–40 %, Gastronomie ca. 25–35 %, reine Dienstleistung 0–10 %' },
  'umsatz.wachstum': { text: 'Steigerungsraten für Umsatz und Kosten können individuell angepasst werden. In der Vorlage werden die Jahre 2 und 3 quartalsweise berechnet.', quellen: ['h. Detail-RentaV (Textfeld)'], app: 'Die App plant Jahr 1 und 2 monatlich; Jahr 3 = Jahr 2 × (1 + Wachstum).', orientierung: 'ca. 0–10 % p. a.; höhere Werte begründen' },

  // ---------- Personal ----------
  'personal.allgemein': { text: 'Planen Sie das erforderliche Personal. Geben Sie das monatliche Arbeitnehmer-Bruttogehalt je Beschäftigtem oder Beschäftigtengruppe an. Die Sozialversicherungsbeiträge und damit die gesamten Arbeitgeberkosten werden automatisch berechnet.', quellen: ['b. Personalplanung (Textfeld)'] },
  'personal.quote': { text: 'Personalaufwand = Löhne und Gehälter + soziale Abgaben + ggf. freiwillige Leistungen des Arbeitgebers (z. B. Urlaubs-, Weihnachtsgeld). Personalquote = Personalkosten ÷ erzielter Umsatz.', quellen: ['i. RentaV-Übersicht!A15', 'h. Detail-RentaV!C95'], orientierung: 'Personalquote Dienstleistung/Handwerk oft 25–45 % des Umsatzes' },

  // ---------- Kapitalbedarf / Invest ----------
  'invest.allgemein': { text: 'Tragen Sie Ihren geplanten Kapitalbedarf ein; die Beispiele können überschrieben werden. Achten Sie auf die richtige Umsatzsteuer. Anschaffungen mit gleicher Abschreibungsdauer können zusammengefasst werden und sollten in einer extra Auflistung der Finanzplanung beigefügt werden.', quellen: ['d. & e. Kapitalbedarfsplan (Textfeld)'] },
  'invest.nd': { text: 'Ist die Anschaffung abschreibungsrelevant (AfA)? Tragen Sie die Abschreibungsdauer ein. Die Nutzungsdauer finden Sie online unter dem Begriff „AfA-Tabellen“. Zwischen 251 € und 800 € kann zwischen Sofortabschreibung und Sammelposten gewählt werden.', quellen: ['d. & e. Kapitalbedarfsplan (Textfeld)', 'f. Investitionsplan!C3'], app: 'Die App fragt die Nutzungsdauer in Jahren ab (Vorlage: Monate).', orientierung: 'AfA-Tabelle: Pkw 6 J., Büromöbel 13 J., Werkstatteinrichtung ca. 10 J., Computer/Software 1 J. (wahlweise)' },
  'invest.monat': { text: 'Anschaffungen werden mit Investitionssumme und Nutzungsdauer aus dem Kapitalbedarfsplan übernommen. Wählen Sie ggf. den tatsächlichen Anschaffungsmonat.', quellen: ['f. Investitionsplan (Textfeld)', 'f. Investitionsplan!E3'], app: 'Ein Eintrag je Investition genügt – die App setzt die Summe automatisch in den gewählten Planmonat.' },
  'invest.gruendung': { text: 'Beachten Sie bei Gründungskosten die eventuell nicht anfallende Umsatzsteuer (z. B. Kaution, Anmeldegebühren, Versicherung). Bei manchen Anschaffungen (z. B. Fachliteratur) ist der Umsatzsteuersatz auf 7 % anzupassen.', quellen: ['d. & e. Kapitalbedarfsplan (Textfeld)'], orientierung: 'Gewerbeanmeldung ca. 20–60 €; Notar/Handelsregister (UG/GmbH) ca. 500–1.000 €' },
  'invest.betriebskosten': { text: 'Die einmaligen Betriebskosten und die Gründungskosten fließen zusätzlich in die Rentabilitätsvorschau ein.', quellen: ['d. & e. Kapitalbedarfsplan!B20', 'd. & e. Kapitalbedarfsplan (Textfeld)'], app: 'Wird automatisch übernommen – keine doppelte Eingabe nötig.' },
  'invest.finanzierung': { text: 'Die Summe des Kapitalbedarfs muss gleich der Summe der Finanzierung sein. Prüfen Sie, ob das Unternehmen vorsteuerabzugsberechtigt ist (Kleinunternehmerregelung). Darlehen von Banken werden nur netto gewährt.', quellen: ['d. & e. Kapitalbedarfsplan (Textfeld)'] },

  // ---------- Kosten ----------
  'kosten.allgemein': { text: 'Sonstige betriebliche Aufwendungen, z. B. betriebliche Mieten (einschließlich Nebenkosten), betriebliche Versicherungen (z. B. Betriebshaftpflicht), Steuerberatung, Telefon, Beiträge (Handwerkskammer, IHK, Berufsgenossenschaft, Kammer), Kfz-Kosten (Steuern, Versicherung, Kraftstoff, Reparaturen), Reisekosten, Werbekosten. Bitte einzelne Posten individuell anpassen.', quellen: ['i. RentaV-Übersicht!A25', 'i. RentaV-Übersicht!A29', 'i. RentaV-Übersicht!A35', 'j. Detail-Liquiditätsplan!B69', 'j. Detail-Liquiditätsplan!B76'] },
  'kosten.steigerung': { text: 'Steigerungsraten für die Kosten können individuell angepasst werden.', quellen: ['h. Detail-RentaV (Textfeld)'], orientierung: 'ca. 2–3 % p. a. (Inflation)' },
  'kosten.gemeinkosten': { text: 'Der Gemeinkostenzuschlag errechnet sich aus den Gemeinkosten geteilt durch die Einzelkosten (hier: Wareneinsatz).', quellen: ['h. Detail-RentaV!C87'] },
  'kosten.Miete Geschäftsräume': { text: 'Betriebliche Miete einschließlich Nebenkosten.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'Gewerbe in Thüringen grob 5–12 €/m² kalt' },
  'kosten.Betriebliche Versicherungen': { text: 'z. B. Betriebshaftpflicht, Inhalts-/Elektronikversicherung.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'ca. 20–100 €/Monat (Betriebshaftpflicht)' },
  'kosten.Beiträge (IHK/HWK, BG, Verbände)': { text: 'Beiträge an Handwerkskammer, IHK, Berufsgenossenschaft, Kammern und Verbände.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'ca. 10–50 €/Monat in den ersten Jahren' },
  'kosten.Kfz-Kosten (betrieblich)': { text: 'Kfz-Kosten (Steuer, Versicherung, Kraftstoff, Reparaturen) – monatlicher Durchschnitt.', quellen: ['i. RentaV-Übersicht!A25', 'a. Kosten privat!A20'], orientierung: 'ca. 250–500 €/Monat je Pkw (ohne Leasing)' },
  'kosten.Steuerberatung / Buchhaltung': { text: 'Steuerberatung und Buchhaltung.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'Einzelunternehmen ca. 100–250 €/Monat' },
  'kosten.Telefon / Internet': { text: 'Betriebliche Telefon- und Internetkosten.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'ca. 30–60 €/Monat' },
  'kosten.Werbung / Marketing': { text: 'Werbekosten, Marketing, Messen.', quellen: ['i. RentaV-Übersicht!A25'], orientierung: 'häufig 2–5 % vom Umsatz, in der Anlaufphase mehr' },
  'kosten.Reisekosten': { text: 'Reisekosten (Fahrt, Übernachtung, Verpflegungsmehraufwand).', quellen: ['i. RentaV-Übersicht!A25'] },
  'kosten.Kontoführung / Zahlungsgebühren': { text: 'Geschäftskonto, Kartenterminal, Zahlungsdienstleister.', quellen: [], orientierung: 'ca. 10–40 €/Monat' },

  // ---------- Darlehen ----------
  'darlehen.allgemein': { text: 'Darlehensplan 1 ist für die weitere Kalkulation gedacht (Mikrodarlehen), weitere Darlehen dienen als zusätzliche Finanzierungsbausteine bzw. als Vergleich. In der Vorlage sind maximal drei Darlehen möglich.', quellen: ['g. Darlehensplan (Textfeld)'], app: 'Die App rechnet alle Darlehen in Liquidität und Rentabilität ein; die KD-Prüfung bezieht sich auf Darlehen 1.' },
  'darlehen.tilgungsfrei': { text: 'Während der tilgungsfreien Zeit wird keine Tilgung gezahlt (in der Vorlage: 0,00 € manuell eintragen).', quellen: ['g. Darlehensplan!B14', 'g. Darlehensplan!B28', 'g. Darlehensplan!B42', 'g. Darlehensplan (Textfeld)'], app: 'Wird automatisch aus „davon tilgungsfrei“ berechnet.', orientierung: 'Mikrodarlehen: bis 12 Monate tilgungsfrei' },
  'darlehen.zinsen': { text: 'Zinsen = Entgelt für auf Zeit überlassenes Kapital, z. B. Bankdarlehen, Privatdarlehen, Kontokorrentkredit.', quellen: ['i. RentaV-Übersicht!A24'] },

  // ---------- Liquidität ----------
  'liq.kaution': { text: 'Kautionen sind nicht als Betriebsausgaben oder -einnahmen steuerwirksam, werden aber für die Liquidität und den Abgleich zwischen Buchhaltung und Kontoauszügen benötigt. Bei der Rückzahlung fallen ggf. Zinseinnahmen bzw. Abschläge für Reparaturen an.', quellen: ['j. Detail-Liquiditätsplan!B67'], orientierung: 'Gewerberaum häufig 2–3 Monatsmieten' },
  'liq.ust': { text: 'Umsatzsteuer-Zahllast: Ist die Vorsteuer höher als die Umsatzsteuer, gibt es eine Erstattung vom Finanzamt, sonst eine Zahlung an das Finanzamt.', quellen: ['k. Ust-Zahllast!A6'], app: 'In der App: positive Zahllast = Zahlung an das Finanzamt.' },
  'liq.privatentnahme': { text: 'Eine negative Privatentnahme wird als Privateinlage angesehen; in der Planung wird die Privatentnahme dann auf 0 gesetzt.', quellen: ['j. Detail-Liquiditätsplan!B87'] },

  // ---------- Rentabilität (Dashboard) ----------
  'renta.umsatz': { text: 'Umsatzerlöse = Summe aller Erträge aus typischen Geschäftsvorgängen, z. B. Verkauf von Waren und Dienstleistungen.', quellen: ['i. RentaV-Übersicht!A9'] },
  'renta.betriebsertrag': { text: 'Betriebsleistung/Betriebsertrag = Summe aller typischen und untypischen Geschäftsvorgänge (Umsatz + sonstige Erträge/Zuschüsse).', quellen: ['i. RentaV-Übersicht!A11'] },
  'renta.aufwand': { text: 'Gesamtaufwand = gesamte betriebliche und sonstige betriebliche Aufwendungen.', quellen: ['i. RentaV-Übersicht!A26'] },
  'renta.betriebsergebnis': { text: 'Betriebsergebnis = Betriebsertrag/Umsatz minus Kosten aller Art.', quellen: ['i. RentaV-Übersicht!A28'] },
  'renta.umsatzrentabilitaet': { text: 'Die Umsatzrentabilität zeigt das Verhältnis von Aufwand und Ertrag: Umsatzrentabilität = Gewinn × 100 ÷ Umsatz.', quellen: ['i. RentaV-Übersicht!A40'], orientierung: 'kleine Unternehmen häufig 5–20 % (stark branchenabhängig)' },

  // ---------- Stundensatz ----------
  'std.privat': { text: 'Betrag aus der Aufstellung der monatlichen privaten Kosten (ohne Rücklage für die Einkommensteuer – diese wird separat angesetzt).', quellen: ['l. Stundensatz-Kalk.!B3'], app: 'Wird aus Schritt 2 übernommen.' },
  'std.betrieb': { text: 'Summe der zu erwartenden Unternehmenskosten.', quellen: ['l. Stundensatz-Kalk.!B8'], app: 'Wird aus Personal, laufenden und einmaligen Kosten übernommen (ohne Material).' },
  'std.kapitaldienst': { text: 'Belastung für Zins und Tilgung aus Finanzierungen.', quellen: ['l. Stundensatz-Kalk.!B9'], app: 'Wird aus dem Darlehensplan übernommen.' },
  'std.afa': { text: 'Die Vorlage setzt hier die monatlichen Abschreibungen an.', quellen: ['l. Stundensatz-Kalk.!B10'], app: 'Die App rechnet zahlungsorientiert mit der Tilgung statt der AfA (sonst würde die Investition doppelt angesetzt).' },
  'std.arbeitstage': { text: 'Freiberufler arbeiten oft auch an Wochenenden und Feiertagen. Dennoch sollten sie nicht mit weniger freien Tagen kalkulieren als der Durchschnitt.', quellen: ['l. Stundensatz-Kalk.!B18'], orientierung: 'Mo–Fr: 260 Tage p. a.' },
  'std.urlaub': { text: 'Bei den Urlaubswünschen nicht hinter den tariflichen Regelungen der Branche zurückbleiben.', quellen: ['l. Stundensatz-Kalk.!B19'], orientierung: '24–30 Tage' },
  'std.krankheit': { text: 'Bitte auch durchschnittliche Krankheitstage pro Jahr mitkalkulieren.', quellen: ['l. Stundensatz-Kalk.!B20'], orientierung: '5–15 Tage' },
  'std.feiertage': { text: 'Gesetzliche Feiertage, die auf Werktage fallen.', quellen: [], orientierung: 'Thüringen ca. 9–11 Tage' },
  'std.auslastung': { text: 'Wie groß ist der Anteil der verkauften Zeit? Nicht verkaufte Tage und nicht bezahlte Rechnungen mindern die fakturierbaren Stunden.', quellen: ['l. Stundensatz-Kalk.!B23'], app: 'Die Vorlage fragt den Ausfall ab, die App die Auslastungsquote (= 100 % − Ausfall).', orientierung: 'Solo-Selbständige häufig 60–80 %' },
  'std.stundenTag': { text: 'Bei der durchschnittlichen täglichen Arbeitszeit nicht schlechter stellen als branchenüblich/tariflich vereinbart.', quellen: ['l. Stundensatz-Kalk.!B26'], orientierung: '8 Stunden' },
  'std.unproduktiv': { text: 'Nicht alle Arbeitsstunden lassen sich direkt einem Auftrag zuordnen (Büroorganisation, Buchhaltung, Reinigung …) – sie müssen trotzdem berücksichtigt werden.', quellen: ['l. Stundensatz-Kalk.!B27'], orientierung: '1–3 Stunden je Tag' },
  'std.satz': { text: 'Aus dem Stundensatz muss z. B. auch die Einkommensteuer bezahlt werden.', quellen: ['l. Stundensatz-Kalk.!B30'] },
  'std.gewinnaufschlag': { text: 'Rücklage bzw. Gewinn, der über die reinen Kosten hinaus erwirtschaftet werden soll (Risiko, Investitionen, Reserve).', quellen: [], orientierung: 'ca. 5–10 % der zu deckenden Kosten' },

  // ---------- Steuern ----------
  'steuern.hebesatz': { text: 'Hebesatz der Gemeinde (geteilt durch 100). Den Wert erfahren Sie bei Ihrer Gemeinde bzw. auf deren Website.', quellen: [], orientierung: 'gesetzliches Minimum 200 %, Städte häufig 350–500 %' },
  'steuern.kvZusatz': { text: 'Zusatzbeitrag Ihrer Krankenkasse – bitte an Ihre Kasse anpassen.', quellen: ['Abgabenrechner!A18'], orientierung: 'Ø-Zusatzbeitrag 2026: 2,9 %' },
} satisfies Record<string, HilfeEintrag>;

export type HilfeKey = keyof typeof HILFE;
export const hilfe = (k: string): HilfeEintrag | undefined => (HILFE as Record<string, HilfeEintrag>)[k];

/** Tooltip-Text: Hilfe + App-Hinweis + Orientierungswert + Fundstelle */
export function hilfeText(k: string): string {
  const h = hilfe(k);
  if (!h) return '';
  return [h.text, h.app ? `In der App: ${h.app}` : '', h.orientierung ? `Orientierungswert (unverbindlich): ${h.orientierung}` : '', h.quellen.length ? `Quelle: Vorlage V107 – ${h.quellen.join(', ')}` : ''].filter(Boolean).join('\n\n');
}

/** Alle Fundstellen der Vorlage, die abgedeckt sind (für Tests/Dokumentation) */
export const abgedeckteQuellen = () => new Set(Object.values(HILFE as Record<string, HilfeEintrag>).flatMap(h => h.quellen));
