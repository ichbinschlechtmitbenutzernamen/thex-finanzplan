import React from 'react';
import type { Plan, Gruender, Rechtsform } from '../model/types';
import type { Ergebnis } from '../calc/plan';
import { jahr, privatKostenMonat, kontoAnalyse, stundensatz, sum, sollIstZeilen } from '../calc/plan';
import { neuerGruender, neuesFeld, neuesDarlehen, uid } from '../model/defaults';
import { Num, Txt, Sel, Check, Field, Card, Help, Tip, fmtEUR, fmtPct } from './fields';

export type Upd = (fn: (p: Plan) => void) => void;
export interface StepProps { plan: Plan; e: Ergebnis; upd: Upd }

export const RECHTSFORMEN: [Rechtsform, string][] = [['EU', 'Einzelunternehmen (gewerblich)'], ['FREI', 'Freiberufler (keine Gewerbesteuer)'], ['GBR', 'GbR / Personengesellschaft'], ['KAPG', 'Kapitalgesellschaft (UG / GmbH)']];

const J = ['Jahr 1', 'Jahr 2', 'Jahr 3'];
const del = <T,>(arr: T[], i: number) => arr.splice(i, 1);

// ---------------- 0 Start ----------------
export function StartStep({ plan, upd, onTutorial, onBeispiel }: StepProps & { onTutorial: () => void; onBeispiel: () => void }) {
  const s = plan.einstellungen;
  return <>
    <Help>Willkommen beim ThEx-Finanzplan. Legen Sie hier die Grundeinstellungen fest. Sie können alles später ändern – abhängige Berechnungen werden automatisch aktualisiert.</Help>
    <Card title="Grundeinstellungen">
      <div className="grid2">
        <Field label="Rechtsform" tip="Bestimmt Steuern (ESt/GewSt bzw. KSt), Entnahmen und den Rechenweg der Kapitaldienstfähigkeit.">
          <Sel value={s.rechtsform} options={RECHTSFORMEN} onChange={v => upd(p => {
            p.einstellungen.rechtsform = v;
            if (v === 'GBR' && p.gruender.length < 2) { p.gruender[0].anteil = 50; const g = neuerGruender('Gesellschafter/in 2'); g.anteil = 50; p.gruender.push(g); }
            if ((v === 'EU' || v === 'FREI') && p.gruender.length > 1) p.gruender = [p.gruender[0]];
            if (v !== 'GBR') p.gruender.forEach(g => (g.anteil = 100 / p.gruender.length));
          })} ariaLabel="Rechtsform" />
        </Field>
        <Field label="Planungsart" tip="Folgedarlehen: zusätzlich Soll-Ist-Vergleich; Gesamtbetrag Mikrodarlehen bis 45.000 €.">
          <Sel value={s.folgedarlehen ? 'f' : 'e'} options={[['e', 'Erstdarlehen'], ['f', 'Folgedarlehen']]} onChange={v => upd(p => (p.einstellungen.folgedarlehen = v === 'f'))} ariaLabel="Planungsart" />
        </Field>
      </div>
      <Check value={s.kleinunternehmer} onChange={v => upd(p => (p.einstellungen.kleinunternehmer = v))} label={<>Kleinunternehmerregelung (§ 19 UStG) – es wird keine Umsatzsteuer berechnet, alle Kosten werden brutto geplant.</>} />
    </Card>
    <Card title="Hinweise und Haftung">
      <p className="muted">Alle Eingaben bleiben ausschließlich in Ihrem Browser (lokaler Speicher dieses Geräts). Sichern Sie Ihren Stand regelmäßig über „Excel exportieren“ – die Datei können Sie später wieder importieren oder an ThEx senden.</p>
      <p className="muted">Der Finanzplan ist ein Planungswerkzeug. Steuern und Sozialabgaben werden vereinfacht geschätzt (Parameter {plan.params.jahr}); er ersetzt keine Steuer- oder Rechtsberatung. Die Entscheidung über das Mikrodarlehen trifft die Thüringer Aufbaubank.</p>
      <Check value={plan.meta.haftungBestaetigt} onChange={v => upd(p => (p.meta.haftungBestaetigt = v))} label={<b>Ich habe die Hinweise gelesen und verstanden.</b>} />
      <div className="row gap">
        <button className="btn ghost" onClick={onTutorial}>Einführung erneut ansehen</button>
        <button className="btn ghost" onClick={onBeispiel}>Beispielprojekt laden</button>
      </div>
    </Card>
  </>;
}

// ---------------- 1 Projekt ----------------
export function ProjektStep({ plan, upd }: StepProps) {
  const pr = plan.projekt;
  const f = (k: keyof Plan['projekt'], l: string, tip?: string, ph?: string) => <Field label={l} tip={tip}><Txt wide value={pr[k]} placeholder={ph} onChange={v => upd(p => (p.projekt[k] = v))} ariaLabel={l} /></Field>;
  return <>
    <Help>Angaben zum Vorhaben. Der <b>Gründungsmonat</b> ist Planmonat 1; alle Pläne laufen 36 Monate ab diesem Monat.</Help>
    <Card title="Vorhaben">
      <div className="grid2">
        {f('name', 'Projekt / Firmenname *', undefined, 'z. B. Muster Werkstatt')}
        <Field label="Gründungsmonat *" tip="Erster Monat der Selbständigkeit = Planmonat 1."><input type="month" value={pr.gruendungsmonat} onChange={e => upd(p => (p.projekt.gruendungsmonat = e.target.value))} aria-label="Gründungsmonat" /></Field>
        {f('vorhaben', 'Kurzbeschreibung des Vorhabens')}
        {f('branche', 'Branche')}
        {f('anschrift', 'Anschrift')}
        {f('gemeinde', 'Gemeinde (Gewerbesteuer-Hebesatz)', 'Den Hebesatz Ihrer Gemeinde tragen Sie in Schritt 9 ein.')}
        {f('telefon', 'Telefon')}
        {f('email', 'E-Mail')}
      </div>
    </Card>
    <Card title={plan.einstellungen.rechtsform === 'GBR' ? 'Gesellschafter/innen' : plan.einstellungen.rechtsform === 'KAPG' ? 'Gesellschafter-Geschäftsführer/innen' : 'Gründer/in'}
      actions={plan.einstellungen.rechtsform === 'GBR' || plan.einstellungen.rechtsform === 'KAPG' ? <button className="btn small" onClick={() => upd(p => { const g = neuerGruender(`Person ${p.gruender.length + 1}`); g.anteil = 0; p.gruender.push(g); })}>+ Person</button> : undefined}>
      <table className="tbl"><thead><tr><th>Name</th>{plan.einstellungen.rechtsform === 'GBR' && <th>Gewinnanteil</th>}<th></th></tr></thead>
        <tbody>{plan.gruender.map((g, i) => <tr key={g.id}>
          <td><Txt value={g.name} onChange={v => upd(p => (p.gruender[i].name = v))} ariaLabel={`Name ${i + 1}`} /></td>
          {plan.einstellungen.rechtsform === 'GBR' && <td><Num value={g.anteil} d={2} suffix="%" onChange={v => upd(p => (p.gruender[i].anteil = v))} /></td>}
          <td>{plan.gruender.length > 1 && <button className="btn link danger" onClick={() => upd(p => del(p.gruender, i))}>entfernen</button>}</td>
        </tr>)}</tbody></table>
    </Card>
  </>;
}

// ---------------- 2 Privat ----------------
function J3Inputs({ werte, onChange, label }: { werte: number[]; onChange: (j: number, v: number) => void; label: string }) {
  return <>{[0, 1, 2].map(j => <td key={j}><Num value={werte[j]} onChange={v => onChange(j, v)} ariaLabel={`${label} ${J[j]}`} /></td>)}</>;
}

export function PrivatStep({ plan, e, upd }: StepProps) {
  const kapg = plan.einstellungen.rechtsform === 'KAPG';
  return <>
    <Help>Tragen Sie Ihre <b>monatlichen privaten Lebenshaltungskosten</b> je Planjahr ein. Krankenversicherung, Rente und Einkommensteuer werden automatisch berechnet und dürfen hier <b>nicht</b> erfasst werden. Tipp: „Jahr 1 → 2/3 übernehmen“ kopiert die Werte.</Help>
    {plan.gruender.map((g, gi) => {
      const st = e.steuerJahre;
      const set = (fn: (g: Gruender) => void) => upd(p => fn(p.gruender[gi]));
      return <Card key={g.id} title={`Private Kosten – ${g.name}`} actions={<button className="btn small ghost" onClick={() => set(x => x.privat.forEach(pp => (pp.werte = [pp.werte[0], pp.werte[0], pp.werte[0]])))}>Jahr 1 → 2/3 übernehmen</button>}>
        <table className="tbl inputs"><thead><tr><th>Position (je Monat)</th>{J.map(j => <th key={j}>{j}</th>)}</tr></thead>
          <tbody>
            {g.privat.map((pp, pi) => <tr key={pp.id}><td><span className="grp">{pp.gruppe}</span> {pp.bez}</td><J3Inputs werte={pp.werte} label={pp.bez} onChange={(j, v) => set(x => (x.privat[pi].werte[j] = v))} /></tr>)}
            <tr className="sum"><td>Summe private Kosten / Monat</td>{[0, 1, 2].map(j => <td key={j}>{fmtEUR(privatKostenMonat(g, j))}</td>)}</tr>
            <tr><td>Private Einnahmen (Partner/in, Kindergeld, Miete …) / Monat <Tip text="Mindern die notwendige Privatentnahme aus dem Unternehmen." /></td><J3Inputs werte={g.einnahmen} label="Einnahmen" onChange={(j, v) => set(x => (x.einnahmen[j] = v))} /></tr>
          </tbody></table>
        <div className="grid3">
          <Field label="Krankenversicherung" tip="Gesetzlich: Beitrag aus Gewinn (mind. Mindestbemessung, max. BBG). Privat: Monatsbeitrag eintragen."><Sel value={g.kv} options={[['gesetzlich', 'gesetzlich'], ['privat', 'privat']]} onChange={v => set(x => (x.kv = v))} /></Field>
          {g.kv === 'privat' ? <Field label="PKV-Beitrag / Monat"><Num value={g.kvPrivatMonat} onChange={v => set(x => (x.kvPrivatMonat = v))} suffix="€" /></Field>
            : <Field label="Pflegeversicherung"><Check value={g.pvKind} onChange={v => set(x => (x.pvKind = v))} label="mit Kind (niedrigerer Satz)" /></Field>}
          <Field label="Rentenversicherung" tip="Pflichtversicherte Selbständige (z. B. Handwerk) oder freiwillig."><Sel value={g.grv} options={[['nein', 'keine'], ['einkommen', 'einkommensgerecht'], ['regel', 'Regelbeitrag'], ['halb', 'halber Regelbeitrag (Existenzgründer)']]} onChange={v => set(x => (x.grv = v))} /></Field>
          <Field label="Kirchensteuer"><Check value={g.kirche} onChange={v => set(x => (x.kirche = v))} label="kirchensteuerpflichtig (9 %)" /></Field>
          <Field label="Gründungszuschuss / Einstiegsgeld je Monat" tip="Wird in der Liquidität als private Einnahme berücksichtigt; zusätzlich zeigt der Plan die Liquidität ohne Zuschuss."><Num value={g.gzBetrag} onChange={v => set(x => (x.gzBetrag = v))} suffix="€" /></Field>
          <Field label="Zuschuss von / bis Planmonat"><span className="row gap"><Num value={g.gzVon} d={0} width={70} onChange={v => set(x => (x.gzVon = v))} /> – <Num value={g.gzBis} d={0} width={70} onChange={v => set(x => (x.gzBis = v))} /></span></Field>
        </div>
        {kapg && <div className="grid3">
          <Field label="GF-Gehalt brutto / Monat" tip="Wird als Personalaufwand der Gesellschaft geplant."><span className="row gap">{[0, 1, 2].map(j => <Num key={j} value={g.gfGehalt[j]} width={96} onChange={v => set(x => (x.gfGehalt[j] = v))} ariaLabel={`GF-Gehalt ${J[j]}`} />)}</span></Field>
          <Field label="Ausschüttung p. a." tip="Gewinnausschüttung an Sie (Abgeltungsteuer)."><span className="row gap">{[0, 1, 2].map(j => <Num key={j} value={g.ausschuettung[j]} width={96} onChange={v => set(x => (x.ausschuettung[j] = v))} ariaLabel={`Ausschüttung ${J[j]}`} />)}</span></Field>
          <Field label="Sozialversicherung GF"><Check value={g.gfSvPflichtig} onChange={v => set(x => (x.gfSvPflichtig = v))} label="SV-pflichtig angestellt" /></Field>
        </div>}
        {!kapg && <table className="tbl result"><thead><tr><th>Berechnet (Plan)</th>{J.map(j => <th key={j}>{j}</th>)}</tr></thead><tbody>
          <tr><td>Gewinnanteil</td>{st.map((s, j) => <td key={j}>{fmtEUR(s.personen[gi]?.gewinn ?? 0)}</td>)}</tr>
          <tr><td>Kranken-/Pflegeversicherung p. a.</td>{st.map((s, j) => <td key={j}>{fmtEUR(s.personen[gi]?.kvpv ?? 0)}</td>)}</tr>
          <tr><td>Rentenversicherung p. a.</td>{st.map((s, j) => <td key={j}>{fmtEUR(s.personen[gi]?.grv ?? 0)}</td>)}</tr>
          <tr><td>ESt + Soli + KiSt p. a.</td>{st.map((s, j) => <td key={j}>{fmtEUR(s.personen[gi]?.steuer ?? 0)}</td>)}</tr>
          <tr className="sum"><td>Privatbedarf gesamt / Monat</td>{[1, 2, 3].map(j => <td key={j}>{fmtEUR(jahr(e.privat[gi].bedarf, j) / 12)}</td>)}</tr>
        </tbody></table>}
      </Card>;
    })}
  </>;
}

// ---------------- 2a Haushaltsbuch / P Kontoauszüge ----------------
function KontoBlock({ g, gi, upd, feld, titel }: { g: Gruender; gi: number; upd: Upd; feld: 'hb' | 'ka'; titel: string }) {
  const a = kontoAnalyse(g[feld].anfang, g[feld].monate);
  const plan1 = privatKostenMonat(g, 0);
  const abw = plan1 ? a.avgAus / plan1 - 1 : 0;
  return <Card title={`${titel} – ${g.name}`} actions={<button className="btn small ghost" onClick={() => upd(p => p.gruender[gi][feld].monate.push({ ein: '', ende: 0 }))}>+ Monat</button>}>
    <Field label="Kontostand zu Beginn"><Num value={g[feld].anfang} suffix="€" onChange={v => upd(p => (p.gruender[gi][feld].anfang = v))} /></Field>
    <table className="tbl inputs"><thead><tr><th>Monat</th><th>Anfang</th><th>Einzahlungen <Tip text="Mehrere Beträge mit + verbinden, z. B. 2100+150,50" /></th><th>Endbestand</th><th>Auszahlungen</th></tr></thead><tbody>
      {a.zeilen.map((z, i) => <tr key={i}><td>Monat {i + 1}</td><td>{fmtEUR(z.anfang, 2)}</td>
        <td><Txt value={g[feld].monate[i].ein} placeholder="z. B. 2100+150" onChange={v => upd(p => (p.gruender[gi][feld].monate[i].ein = v))} /> <span className="muted small">= {fmtEUR(z.ein, 2)}</span></td>
        <td><Num value={g[feld].monate[i].ende} onChange={v => upd(p => (p.gruender[gi][feld].monate[i].ende = v))} /></td><td>{fmtEUR(z.aus, 2)}</td></tr>)}
    </tbody></table>
    <p className="kpi-inline">Ø Auszahlungen: <b>{fmtEUR(a.avgAus)}</b> · geplante private Kosten Jahr 1: <b>{fmtEUR(plan1)}</b>{a.anzahl > 0 && plan1 > 0 && <> · Abweichung <b className={Math.abs(abw) > 0.1 ? 'neg' : 'pos'}>{fmtPct(abw)}</b></>}</p>
  </Card>;
}
export function HaushaltsbuchStep({ plan, upd }: StepProps) {
  return <><Help>Optional: Prüfen Sie Ihre geplanten privaten Kosten mit einem Haushaltsbuch. Aus Anfangs- und Endbestand und den Einzahlungen ergeben sich die tatsächlichen Auszahlungen je Monat.</Help>
    {plan.gruender.map((g, gi) => <KontoBlock key={g.id} g={g} gi={gi} upd={upd} feld="hb" titel="Haushaltsbuch" />)}</>;
}
export function PruefungStep({ plan, upd }: StepProps) {
  return <><Help>Prüfer-Bereich: Kontoauszugsanalyse der letzten Monate und Prüfvermerk. Abweichungen über {fmtPct(plan.params.kontoauszugToleranz, 0)} zu den geplanten privaten Kosten werden markiert.</Help>
    {plan.gruender.map((g, gi) => <KontoBlock key={g.id} g={g} gi={gi} upd={upd} feld="ka" titel="Kontoauszugsanalyse" />)}
    <Card title="Prüfvermerk"><div className="grid3">
      <Field label="Status"><Sel value={plan.pruefung.status} options={[['offen', 'offen'], ['geprueft', 'geprüft'], ['nachbesserung', 'Nachbesserung nötig']]} onChange={v => upd(p => (p.pruefung.status = v))} /></Field>
      <Field label="Prüfer/in"><Txt value={plan.pruefung.pruefer} onChange={v => upd(p => (p.pruefung.pruefer = v))} /></Field>
      <Field label="Datum"><input type="date" value={plan.pruefung.datum} onChange={e => upd(p => (p.pruefung.datum = e.target.value))} /></Field></div>
      <Field label="Vermerk"><textarea rows={4} value={plan.pruefung.vermerk} onChange={e => upd(p => (p.pruefung.vermerk = e.target.value))} /></Field>
    </Card></>;
}

// ---------------- 3 Umsatz ----------------
export function UmsatzStep({ plan, e, upd }: StepProps) {
  const [jahrSicht, setJahr] = React.useState(0);
  const ms = Array.from({ length: 12 }, (_, i) => jahrSicht * 12 + i);
  return <>
    <Help>Planen Sie je Geschäftsfeld <b>Nettopreis × Menge</b> für jeden Monat der ersten 24 Monate. Mit dem <b>Anlauffaktor</b> bilden Sie eine Anlaufphase oder Saison ab (100 % = voll). Jahr 3 ergibt sich aus Jahr 2 und der Wachstumsrate. Die <b>Materialquote</b> (Wareneinsatz/Fremdleistung in % vom Umsatz) bestimmt den Materialaufwand.</Help>
    <Card title="Umsatz-Einstellungen" actions={<button className="btn small" onClick={() => upd(p => p.umsatz.felder.push(neuesFeld(`Geschäftsfeld ${p.umsatz.felder.length + 1}`)))}>+ Geschäftsfeld</button>}>
      <div className="row gap wrap">
        <Field label="Wachstum Jahr 3 ggü. Jahr 2"><Num pct value={plan.umsatz.wachstumJ3} onChange={v => upd(p => (p.umsatz.wachstumJ3 = v))} /></Field>
        <Field label="Ansicht"><Sel value={String(jahrSicht) as '0' | '1'} options={[['0', 'Jahr 1 (Monat 1–12)'], ['1', 'Jahr 2 (Monat 13–24)']]} onChange={v => setJahr(Number(v))} /></Field>
      </div>
      <div className="scroll"><table className="tbl inputs compact"><thead><tr><th></th>{ms.map(m => <th key={m}>{e.labels[m]}</th>)}</tr></thead><tbody>
        <tr><td>Anlauffaktor</td>{ms.map(m => <td key={m}><Num pct value={plan.umsatz.faktor[m]} onChange={v => upd(p => (p.umsatz.faktor[m] = v))} ariaLabel={`Faktor ${m + 1}`} /></td>)}</tr>
      </tbody></table></div>
    </Card>
    {plan.umsatz.felder.map((f, fi) => {
      const set = (fn: (x: typeof f) => void) => upd(p => fn(p.umsatz.felder[fi]));
      return <Card key={f.id} title={<Txt value={f.name} onChange={v => set(x => (x.name = v))} ariaLabel="Name Geschäftsfeld" placeholder="Geschäftsfeld" />}
        actions={<>
          <button className="btn small ghost" onClick={() => set(x => { for (let m = 1; m < 24; m++) { x.preis[m] = x.preis[0]; } })}>Preis M1 → alle</button>
          {plan.umsatz.felder.length > 1 && <button className="btn link danger" onClick={() => upd(p => del(p.umsatz.felder, fi))}>entfernen</button>}</>}>
        <div className="row gap wrap">
          <Field label="USt-Satz"><Sel value={String(f.ust) as any} options={[['0.19', '19 %'], ['0.07', '7 %'], ['0', '0 % / steuerfrei']]} onChange={v => set(x => (x.ust = Number(v)))} /></Field>
          <Field label="Materialquote" tip="Anteil Material, Waren oder Fremdleistungen am Nettoumsatz."><Num pct value={f.materialQuote} onChange={v => set(x => (x.materialQuote = v))} /></Field>
          <Field label="Umsatz netto"><span className="kpi-inline">{J.map((j, i) => <span key={j}>{j}: <b>{fmtEUR(jahr(e.umsatzGF[fi], i + 1))}</b> </span>)}</span></Field>
        </div>
        <div className="scroll"><table className="tbl inputs compact"><thead><tr><th></th>{ms.map(m => <th key={m}>{e.labels[m]}</th>)}</tr></thead><tbody>
          <tr><td>Preis netto</td>{ms.map(m => <td key={m}><Num value={f.preis[m]} onChange={v => set(x => (x.preis[m] = v))} ariaLabel={`Preis ${m + 1}`} /></td>)}</tr>
          <tr><td>Menge</td>{ms.map(m => <td key={m}><Num value={f.menge[m]} onChange={v => set(x => (x.menge[m] = v))} ariaLabel={`Menge ${m + 1}`} /></td>)}</tr>
          <tr className="sum"><td>Umsatz</td>{ms.map(m => <td key={m}>{fmtEUR(e.umsatzGF[fi][m])}</td>)}</tr>
        </tbody></table></div>
      </Card>;
    })}
  </>;
}

// ---------------- 4 Personal ----------------
export function PersonalStep({ plan, e, upd }: StepProps) {
  return <>
    <Help>Geplante Mitarbeiter/innen mit Bruttogehalt. Die Arbeitgeberkosten werden mit {fmtPct(plan.params.agSv)} (SV-pflichtig) bzw. {fmtPct(plan.params.agMinijob)} (Minijob) aufgeschlagen. Keine Mitarbeiter? Dann einfach „Schritt abschließen“.{plan.einstellungen.rechtsform === 'KAPG' && ' Das Geschäftsführergehalt wird in Schritt 2 erfasst.'}</Help>
    <Card title="Stellen" actions={<button className="btn small" onClick={() => upd(p => p.personal.push({ id: uid(), bez: '', art: 'sv', brutto: 0, von: 1, bis: 36 }))}>+ Stelle</button>}>
      {plan.personal.length === 0 ? <p className="muted">Keine Mitarbeiter geplant.</p> :
        <table className="tbl inputs"><thead><tr><th>Stelle</th><th>Art</th><th>Brutto / Monat</th><th>von Monat</th><th>bis Monat</th><th>AG-Kosten Jahr 1</th><th></th></tr></thead><tbody>
          {plan.personal.map((s, i) => <tr key={s.id}>
            <td><Txt value={s.bez} onChange={v => upd(p => (p.personal[i].bez = v))} placeholder="z. B. Aushilfe" /></td>
            <td><Sel value={s.art} options={[['sv', 'SV-pflichtig'], ['minijob', 'Minijob']]} onChange={v => upd(p => (p.personal[i].art = v))} /></td>
            <td><Num value={s.brutto} onChange={v => upd(p => (p.personal[i].brutto = v))} /></td>
            <td><Num d={0} value={s.von} min={1} max={36} onChange={v => upd(p => (p.personal[i].von = v))} /></td>
            <td><Num d={0} value={s.bis} min={1} max={36} onChange={v => upd(p => (p.personal[i].bis = v))} /></td>
            <td>{fmtEUR(Array.from({ length: 12 }, (_, m) => (m + 1 >= s.von && m + 1 <= s.bis ? s.brutto * (1 + (s.art === 'minijob' ? plan.params.agMinijob : plan.params.agSv)) : 0)).reduce((a, b) => a + b, 0))}</td>
            <td><button className="btn link danger" onClick={() => upd(p => del(p.personal, i))}>×</button></td></tr>)}
        </tbody></table>}
      <p className="kpi-inline">Personalaufwand: {J.map((j, i) => <span key={j}>{j} <b>{fmtEUR(jahr(e.personal, i + 1))}</b> </span>)}</p>
    </Card>
  </>;
}

// ---------------- 5 Kapitalbedarf ----------------
export function InvestStep({ plan, e, upd }: StepProps) {
  const einmal = (key: 'betriebskosten' | 'gruendungskosten', titel: string, tip: string) => <Card title={titel} help={tip} actions={<button className="btn small" onClick={() => upd(p => p[key].push({ id: uid(), bez: '', netto: 0, ust: 0.19, monat: 1 }))}>+ Position</button>}>
    {plan[key].length > 0 && <table className="tbl inputs"><thead><tr><th>Bezeichnung</th><th>Netto</th><th>USt</th><th>Planmonat</th><th></th></tr></thead><tbody>
      {plan[key].map((x, i) => <tr key={x.id}><td><Txt value={x.bez} onChange={v => upd(p => (p[key][i].bez = v))} /></td><td><Num value={x.netto} onChange={v => upd(p => (p[key][i].netto = v))} /></td>
        <td><Num pct value={x.ust} onChange={v => upd(p => (p[key][i].ust = v))} /></td><td><Num d={0} value={x.monat} min={1} max={36} onChange={v => upd(p => (p[key][i].monat = v))} /></td>
        <td><button className="btn link danger" onClick={() => upd(p => del(p[key], i))}>×</button></td></tr>)}</tbody></table>}
  </Card>;
  const kb = e.kapitalbedarf;
  return <>
    <Help>Investitionen (Anschaffungskosten netto) werden über die Nutzungsdauer monatlich abgeschrieben; <b>geringwertige Wirtschaftsgüter</b> (GWG, bis 800 € netto) sofort. Einmalige Betriebs- und Gründungskosten sind sofort Aufwand. Die Umsatzsteuer wird je Position mit ihrem eigenen Satz berücksichtigt.</Help>
    <Card title="Investitionen" actions={<button className="btn small" onClick={() => upd(p => p.invest.push({ id: uid(), bez: '', netto: 0, ust: 0.19, monat: 1, ndJahre: 5, gwg: false }))}>+ Investition</button>}>
      {plan.invest.length > 0 && <table className="tbl inputs"><thead><tr><th>Bezeichnung</th><th>Netto</th><th>USt</th><th>Planmonat</th><th>Nutzungsdauer (J.)</th><th>GWG</th><th>AfA / Jahr</th><th></th></tr></thead><tbody>
        {plan.invest.map((x, i) => <tr key={x.id}>
          <td><Txt value={x.bez} onChange={v => upd(p => (p.invest[i].bez = v))} /></td><td><Num value={x.netto} onChange={v => upd(p => (p.invest[i].netto = v))} /></td>
          <td><Num pct value={x.ust} onChange={v => upd(p => (p.invest[i].ust = v))} /></td><td><Num d={0} value={x.monat} min={1} max={36} onChange={v => upd(p => (p.invest[i].monat = v))} /></td>
          <td><Num d={1} value={x.ndJahre} onChange={v => upd(p => (p.invest[i].ndJahre = v))} /></td>
          <td><input type="checkbox" checked={x.gwg} onChange={ev => upd(p => (p.invest[i].gwg = ev.target.checked))} aria-label="GWG" />{x.gwg && x.netto > 800 && <span className="warn-inline" title="GWG nur bis 800 € netto">!</span>}</td>
          <td>{fmtEUR(x.gwg ? x.netto : x.ndJahre > 0 ? x.netto / x.ndJahre : x.netto)}</td>
          <td><button className="btn link danger" onClick={() => upd(p => del(p.invest, i))}>×</button></td></tr>)}</tbody></table>}
    </Card>
    {einmal('betriebskosten', 'Einmalige Betriebskosten', 'z. B. Erstausstattung Warenlager, Renovierung, Markteinführung. Einmalige Kosten im angegebenen Monat.')}
    {einmal('gruendungskosten', 'Gründungskosten', 'z. B. Gewerbeanmeldung, Notar, Handelsregister, Beratung.')}
    <Card title="Kapitalbedarf">
      <table className="tbl result"><tbody>
        <tr><td>Investitionen</td><td>{fmtEUR(kb.invest)}</td></tr><tr><td>Einmalige Betriebskosten</td><td>{fmtEUR(kb.betriebskosten)}</td></tr><tr><td>Gründungskosten</td><td>{fmtEUR(kb.gruendungskosten)}</td></tr>
        <tr className="sum"><td>Kapitalbedarf netto</td><td>{fmtEUR(kb.summe)}</td></tr><tr><td>zzgl. Umsatzsteuer (Vorfinanzierung bis zur Erstattung)</td><td>{fmtEUR(kb.ustSumme)}</td></tr>
      </tbody></table>
    </Card>
  </>;
}

// ---------------- 6 Kosten ----------------
export function KostenStep({ plan, e, upd }: StepProps) {
  const zr = (key: 'zuschuesse' | 'aoErtrag' | 'aoAufwand', titel: string) => <Card title={titel} actions={<button className="btn small" onClick={() => upd(p => p.kosten[key].push({ id: uid(), bez: '', betrag: 0, von: 1, bis: 1 }))}>+ Position</button>}>
    {plan.kosten[key].length > 0 && <table className="tbl inputs"><thead><tr><th>Bezeichnung</th><th>Betrag / Monat</th><th>von Monat</th><th>bis Monat</th><th></th></tr></thead><tbody>
      {plan.kosten[key].map((z, i) => <tr key={z.id}><td><Txt value={z.bez} onChange={v => upd(p => (p.kosten[key][i].bez = v))} /></td><td><Num value={z.betrag} onChange={v => upd(p => (p.kosten[key][i].betrag = v))} /></td>
        <td><Num d={0} value={z.von} min={1} max={36} onChange={v => upd(p => (p.kosten[key][i].von = v))} /></td><td><Num d={0} value={z.bis} min={1} max={36} onChange={v => upd(p => (p.kosten[key][i].bis = v))} /></td>
        <td><button className="btn link danger" onClick={() => upd(p => del(p.kosten[key], i))}>×</button></td></tr>)}</tbody></table>}
  </Card>;
  return <>
    <Help>Laufende betriebliche Kosten <b>netto</b> für die 12 Monate des ersten Jahres. Jahr 2 und 3 werden mit den Steigerungsraten hochgerechnet. Mit „M1 → alle“ übertragen Sie einen Monatswert auf das ganze Jahr.</Help>
    <Card title="Laufende Kosten Jahr 1" actions={<span className="row gap">
      <Field label="Steigerung J2"><Num pct value={plan.kosten.steigerungJ2} onChange={v => upd(p => (p.kosten.steigerungJ2 = v))} /></Field>
      <Field label="Steigerung J3"><Num pct value={plan.kosten.steigerungJ3} onChange={v => upd(p => (p.kosten.steigerungJ3 = v))} /></Field>
      <button className="btn small" onClick={() => upd(p => p.kosten.posten.push({ id: uid(), bez: 'Neue Position', ust: 0.19, monate: Array(12).fill(0) }))}>+ Position</button></span>}>
      <div className="scroll"><table className="tbl inputs compact"><thead><tr><th>Position</th><th>USt</th>{e.labels.slice(0, 12).map(l => <th key={l}>{l}</th>)}<th>Jahr 1</th><th></th></tr></thead><tbody>
        {plan.kosten.posten.map((k, i) => <tr key={k.id}>
          <td><Txt value={k.bez} onChange={v => upd(p => (p.kosten.posten[i].bez = v))} /></td>
          <td><Sel value={String(k.ust) as any} options={[['0.19', '19 %'], ['0.07', '7 %'], ['0', '0 %']]} onChange={v => upd(p => (p.kosten.posten[i].ust = Number(v)))} /></td>
          {k.monate.map((v, m) => <td key={m}><Num value={v} onChange={x => upd(p => (p.kosten.posten[i].monate[m] = x))} ariaLabel={`${k.bez} M${m + 1}`} /></td>)}
          <td className="b">{fmtEUR(sum(k.monate))}</td>
          <td className="nowrap"><button className="btn link" title="Wert aus Monat 1 auf alle Monate übertragen" onClick={() => upd(p => (p.kosten.posten[i].monate = p.kosten.posten[i].monate.map(() => p.kosten.posten[i].monate[0])))}>M1 → alle</button> <button className="btn link danger" onClick={() => upd(p => del(p.kosten.posten, i))}>×</button></td>
        </tr>)}
      </tbody></table></div>
      <p className="kpi-inline">Sonstige Kosten: {J.map((j, i) => <span key={j}>{j} <b>{fmtEUR(jahr(e.kosten, i + 1))}</b> </span>)}</p>
    </Card>
    {zr('zuschuesse', 'Zuschüsse / sonstige betriebliche Erträge')}
    {zr('aoErtrag', 'Außerordentliche Erträge')}
    {zr('aoAufwand', 'Außerordentliche Aufwendungen')}
  </>;
}

// ---------------- 7 Darlehen ----------------
export function DarlehenStep({ plan, e, upd }: StepProps) {
  return <>
    <Help>Darlehen 1 ist das <b>Mikrodarlehen</b> der Thüringer Aufbaubank (5.000–35.000 €, Folgedarlehen bis 45.000 € gesamt; Laufzeit bis 84 Monate, davon bis zu 12 tilgungsfrei; die Laufzeit verlängert sich dadurch nicht). Zins und Tilgung werden monatlich nachträglich gezahlt. Weitere oder bereits laufende Kredite sind meist <b>Annuitätendarlehen</b>.</Help>
    {plan.darlehen.map((d, i) => {
      const set = (fn: (x: typeof d) => void) => upd(p => fn(p.darlehen[i]));
      const t = e.darlehen[i].plan;
      return <Card key={d.id} title={<>{i === 0 ? 'Darlehen 1 – ' : `Darlehen ${i + 1} – `}<Txt value={d.bez} onChange={v => set(x => (x.bez = v))} /></>}
        actions={i > 0 ? <button className="btn link danger" onClick={() => upd(p => del(p.darlehen, i))}>entfernen</button> : undefined}>
        <div className="grid4">
          <Field label={d.bestehend ? 'Restschuld heute' : 'Darlehensbetrag'}><Num value={d.betrag} suffix="€" onChange={v => set(x => (x.betrag = v))} ariaLabel={`Betrag Darlehen ${i + 1}`} /></Field>
          <Field label={d.bestehend ? 'Restlaufzeit (Monate)' : 'Laufzeit (Monate)'} tip="Gesamtlaufzeit inklusive tilgungsfreier Monate."><Num d={0} value={d.laufzeit} onChange={v => set(x => (x.laufzeit = v))} /></Field>
          <Field label="davon tilgungsfrei"><Num d={0} value={d.tilgungsfrei} onChange={v => set(x => (x.tilgungsfrei = v))} /></Field>
          <Field label="Art"><Sel value={d.art} options={[['tilgung', 'Tilgungsdarlehen (gleiche Tilgung)'], ['annuitaet', 'Annuitätendarlehen (gleiche Rate)']]} onChange={v => set(x => (x.art = v))} /></Field>
          <Field label="Sollzins p. a." tip="Gerechnet wird mit dem Sollzins (Nominalzins)."><Num pct value={d.sollzins} onChange={v => set(x => (x.sollzins = v))} /></Field>
          <Field label="Effektivzins p. a. (Info)"><Num pct value={d.effzins} onChange={v => set(x => (x.effzins = v))} /></Field>
          {!d.bestehend && <Field label="Auszahlung im Planmonat"><Num d={0} value={d.auszahlungMonat} min={1} max={36} onChange={v => set(x => (x.auszahlungMonat = v))} /></Field>}
          {i > 0 && <Field label="Status"><Check value={d.bestehend} onChange={v => set(x => (x.bestehend = v))} label="bereits ausgezahlt (bestehender Kredit)" /></Field>}
        </div>
        {t.length > 0 && <>
          <p className="kpi-inline">Rate ab Tilgungsbeginn: <b>{fmtEUR(t[Math.min(d.tilgungsfrei, t.length - 1)].rate, 2)}</b> · Zinsen gesamt: <b>{fmtEUR(t.reduce((s, z) => s + z.zins, 0), 2)}</b> · Kapitaldienst Plan-Jahr 2: <b>{fmtEUR(jahr(e.darlehen[i].plan.reduce((a, z) => { if (z.planMonat <= 36) a[z.planMonat - 1] += z.rate; return a; }, Array(36).fill(0)), 2), 2)}</b></p>
          <details><summary>Tilgungsplan anzeigen ({t.length} Monate)</summary>
            <div className="scroll tall"><table className="tbl result compact"><thead><tr><th>Monat</th><th>Planmonat</th><th>Restschuld Anfang</th><th>Zins</th><th>Tilgung</th><th>Rate</th><th>Restschuld Ende</th></tr></thead><tbody>
              {t.map(z => <tr key={z.k}><td>{z.k}</td><td>{z.planMonat <= 36 ? e.labels[z.planMonat - 1] : `M ${z.planMonat}`}</td><td>{fmtEUR(z.restAnfang, 2)}</td><td>{fmtEUR(z.zins, 2)}</td><td>{fmtEUR(z.tilgung, 2)}</td><td>{fmtEUR(z.rate, 2)}</td><td>{fmtEUR(z.restEnde, 2)}</td></tr>)}
            </tbody></table></div></details></>}
      </Card>;
    })}
    <div className="row gap"><button className="btn ghost" onClick={() => upd(p => p.darlehen.push(neuesDarlehen(false)))}>+ weiteres Darlehen</button><button className="btn ghost" onClick={() => upd(p => p.darlehen.push(neuesDarlehen(true)))}>+ bestehender Kredit</button></div>
  </>;
}

// ---------------- 8 Liquidität ----------------
export function LiquiditaetStep({ plan, e, upd }: StepProps) {
  const em = plan.eigenmittel;
  const zeile = (l: string, k: 'bar' | 'privatdarlehen' | 'sachzuschuss', km: 'barMonat' | 'privatdarlehenMonat' | 'sachzuschussMonat', tip: string) =>
    <tr><td>{l} <Tip text={tip} /></td><td><Num value={em[k]} onChange={v => upd(p => (p.eigenmittel[k] = v))} /></td><td><Num d={0} value={em[km]} min={1} max={36} onChange={v => upd(p => (p.eigenmittel[km] = v))} /></td></tr>;
  return <>
    <Help>Eigenmittel, Kaution und die Zahlweise der Umsatzsteuer. Private Einnahmen und Gründungszuschuss haben Sie bereits in Schritt 2 erfasst; sie mindern die Privatentnahme in der Liquidität.</Help>
    <Card title="Eigenmittel und Kaution">
      <table className="tbl inputs"><thead><tr><th></th><th>Betrag</th><th>Planmonat</th></tr></thead><tbody>
        {zeile('Barmittel / Einlage', 'bar', 'barMonat', 'Eigenes Geld, das Sie in das Unternehmen einbringen.')}
        {zeile('Privatdarlehen (Familie, Freunde)', 'privatdarlehen', 'privatdarlehenMonat', 'Zufluss in der Liquidität; Rückzahlung bitte als „bestehender Kredit“ oder a.o. Aufwand planen.')}
        {zeile('Sachmittelzuschuss (z. B. Jobcenter)', 'sachzuschuss', 'sachzuschussMonat', 'Zuschuss für Sachmittel als Einzahlung.')}
        <tr><td>Sacheinlagen (Wert, nicht liquiditätswirksam)</td><td><Num value={em.sacheinlage} onChange={v => upd(p => (p.eigenmittel.sacheinlage = v))} /></td><td></td></tr>
        <tr><td>Mietkaution</td><td><Num value={plan.liquiditaet.kaution} onChange={v => upd(p => (p.liquiditaet.kaution = v))} /></td><td><Num d={0} value={plan.liquiditaet.kautionMonat} min={1} max={36} onChange={v => upd(p => (p.liquiditaet.kautionMonat = v))} /></td></tr>
      </tbody></table>
      <Field label="Zahlung der Umsatzsteuer" tip="Monatlich im Folgemonat ist der Normalfall für Gründer; mit Dauerfristverlängerung einen Monat später."><Sel value={plan.liquiditaet.ustModus} options={[['folgemonat', 'monatlich, im Folgemonat'], ['dfv', 'monatlich mit Dauerfristverlängerung'], ['quartal', 'vierteljährlich'], ['sofort', 'im selben Monat (vereinfacht)']]} onChange={v => upd(p => (p.liquiditaet.ustModus = v))} /></Field>
    </Card>
    <Card title="Liquidität kumuliert (Vorschau)">
      <p className="kpi-inline">Tiefster Stand: <b className={e.liq.tiefpunkt < 0 ? 'neg' : 'pos'}>{fmtEUR(e.liq.tiefpunkt)}</b> im {e.labels[e.liq.tiefpunktIdx]} · Ende Jahr 1: <b>{fmtEUR(e.liq.kumuliert[11])}</b> · Ende Jahr 3: <b>{fmtEUR(e.liq.kumuliert[35])}</b></p>
    </Card>
  </>;
}

// ---------------- 9 Steuern ----------------
export function SteuernStep({ plan, e, upd }: StepProps) {
  const pp = plan.params;
  const n = (k: keyof typeof pp, l: string, pct = false, tip?: string) => <Field label={l} tip={tip}><Num pct={pct} value={pp[k] as number} onChange={v => upd(p => ((p.params as any)[k] = v))} /></Field>;
  const kapg = plan.einstellungen.rechtsform === 'KAPG';
  return <>
    <Help>Prüfen Sie die Pauschalen. Wichtig ist vor allem der <b>Gewerbesteuer-Hebesatz Ihrer Gemeinde</b> und der <b>Zusatzbeitrag Ihrer Krankenkasse</b>. Werte für {pp.jahr}; Änderungen gelten nur für diesen Plan.</Help>
    <Card title="Parameter">
      <div className="grid4">
        {n('hebesatz', 'GewSt-Hebesatz (4,7 = 470 %)', false, 'Hebesatz der Gemeinde geteilt durch 100.')}
        {n('kvZusatz', 'KV-Zusatzbeitrag', true)}{n('kvSatz', 'KV allgemeiner/ermäßigter Satz', true)}{n('kvKrankengeld', 'KV Krankengeld-Anteil', true)}
        {n('pvKinderlos', 'PV kinderlos', true)}{n('pvKind', 'PV mit Kind', true)}{n('kvMindestBemessungMonat', 'KV-Mindestbemessung / Monat')}{n('kvBbg', 'BBG KV/PV p. a.')}
        {n('grvSatz', 'Rentenversicherung', true)}{n('grvRegelbeitrag', 'GRV-Regelbeitrag / Monat')}{n('agSv', 'AG-Anteil SV', true)}{n('agMinijob', 'AG-Anteil Minijob', true)}
        {n('kdGrenze', 'KD-Grenzwert', true, 'Kapitaldienst darf höchstens diesen Anteil der KD-Grenze ausmachen.')}{n('kdGelb', 'KD gelbe Zone ab', true)}
      </div>
    </Card>
    <Card title="Steuern im Plan">
      <table className="tbl result"><thead><tr><th></th>{J.map(j => <th key={j}>{j}</th>)}</tr></thead><tbody>
        <tr><td>Ergebnis vor Steuern</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.ergebnis)}</td>)}</tr>
        <tr><td>Gewerbesteuer</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.gewSt)}</td>)}</tr>
        {kapg && <tr><td>Körperschaftsteuer inkl. Soli</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.kst)}</td>)}</tr>}
        {!kapg && plan.gruender.map((g, gi) => <React.Fragment key={g.id}>
          <tr><td>{g.name}: Sozialversicherung</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.personen[gi]?.sv ?? 0)}</td>)}</tr>
          <tr><td>{g.name}: ESt nach § 35 + Soli + KiSt</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.personen[gi]?.steuer ?? 0)}</td>)}</tr></React.Fragment>)}
        {kapg && plan.gruender.map((g, gi) => <tr key={g.id}><td>{g.name}: netto verfügbar (Gehalt + Ausschüttung)</td>{e.steuerJahre.map(s => <td key={s.j}>{fmtEUR(s.gf[gi]?.netto ?? 0)}</td>)}</tr>)}
      </tbody></table>
      <p className="muted small">Gewerbesteuer in der Liquidität: Jahr 1 als Nachzahlung im 18. Planmonat, Jahr 2 und 3 als Vorauszahlungen quartalsweise im jeweiligen Jahr.</p>
    </Card>
  </>;
}

// ---------------- 11 Stundensatz ----------------
export function StundensatzStep({ plan, e, upd }: StepProps) {
  const s = plan.stundensatz, r = stundensatz(plan, e);
  const n = (k: keyof typeof s, l: string, pct = false) => <Field label={l}><Num pct={pct} d={1} value={s[k] as number} onChange={v => upd(p => ((p.stundensatz as any)[k] = v))} /></Field>;
  return <>
    <Help>Welchen Stundensatz brauchen Sie mindestens, um private Kosten, Betriebskosten, Kapitaldienst und Steuern zu decken? Grundlage sind Ihre bisherigen Eingaben.</Help>
    <Card title="Annahmen">
      <Check value={s.aktiv} onChange={v => upd(p => (p.stundensatz.aktiv = v))} label="Stundensatz-Kalkulation in den Excel-Export aufnehmen" />
      <div className="grid4">
        <Field label="Basis Planjahr"><Sel value={String(s.jahr) as '1'} options={[['1', 'Jahr 1'], ['2', 'Jahr 2'], ['3', 'Jahr 3']]} onChange={v => upd(p => (p.stundensatz.jahr = Number(v) as 1))} /></Field>
        {n('arbeitstage', 'Arbeitstage p. a.')}{n('urlaub', 'Urlaubstage')}{n('krankheit', 'Krankheitstage')}{n('feiertage', 'Feiertage')}{n('stundenTag', 'Stunden / Tag')}{n('unproduktiv', 'davon unproduktiv (Büro, Akquise)')}{n('ausfall', 'Auslastungsausfall', true)}{n('gewinnaufschlag', 'Gewinnaufschlag / Rücklage p. a.')}
      </div>
    </Card>
    <Card title="Ergebnis"><table className="tbl result"><tbody>
      <tr><td>Privatbedarf inkl. SV und Steuern</td><td>{fmtEUR(r.privat)}</td></tr><tr><td>Betriebliche Kosten (ohne Material)</td><td>{fmtEUR(r.betrieb)}</td></tr><tr><td>Kapitaldienst</td><td>{fmtEUR(r.kapitaldienst)}</td></tr>
      <tr><td>Betriebliche Steuern</td><td>{fmtEUR(r.steuern)}</td></tr><tr><td>Gewinnaufschlag</td><td>{fmtEUR(r.gewinnaufschlag)}</td></tr><tr className="sum"><td>Zu decken</td><td>{fmtEUR(r.basis)}</td></tr>
      <tr><td>Produktive Stunden p. a.</td><td>{Math.round(r.stunden).toLocaleString('de-DE')} h</td></tr>
      <tr className="sum big"><td>Mindest-Stundensatz netto</td><td>{fmtEUR(r.satz, 2)}</td></tr><tr><td>Mindest-Tagessatz netto ({r.hTag} produktive h)</td><td>{fmtEUR(r.tagessatz, 2)}</td></tr>
    </tbody></table></Card>
  </>;
}

// ---------------- 12 Soll-Ist ----------------
export function SollIstStep({ plan, e, upd }: StepProps) {
  const n = plan.sollIst.monate;
  return <>
    <Help>Für Folgedarlehen: Vergleichen Sie die bisherigen Ist-Zahlen (z. B. aus der BWA) mit dem Plan der ersten Monate.</Help>
    <Card title="Soll-Ist-Vergleich">
      <Field label="Verglichene Monate (ab Planmonat 1)"><Num d={0} value={n} min={1} max={36} onChange={v => upd(p => (p.sollIst.monate = v))} /></Field>
      <table className="tbl inputs"><thead><tr><th>Position</th><th>Soll (Plan)</th><th>Ist</th><th>Abweichung</th><th>%</th></tr></thead><tbody>
        {sollIstZeilen(e).map(([k, l, a]) => { const soll = sum(a, 0, n), ist = plan.sollIst.ist[k] ?? 0; const d = ist - soll; return <tr key={k}><td>{l}</td><td>{fmtEUR(soll)}</td><td><Num value={ist} onChange={v => upd(p => (p.sollIst.ist[k] = v))} /></td><td className={d < 0 ? 'neg' : ''}>{fmtEUR(d)}</td><td>{soll ? fmtPct(d / soll) : '–'}</td></tr>; })}
      </tbody></table>
    </Card>
  </>;
}
