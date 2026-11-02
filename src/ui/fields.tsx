import React, { useEffect, useState } from 'react';

export const fmtEUR = (v: number, d = 0) => (isFinite(v) ? (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €' : '–');
export const fmtNum = (v: number, d = 2) => (isFinite(v) ? v.toLocaleString('de-DE', { maximumFractionDigits: d }) : '');
export const fmtPct = (v: number, d = 1) => (isFinite(v) ? (v * 100).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %' : '–');

export function parseDE(s: string): number {
  const t = s.replace(/\s|€|%/g, '');
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return isFinite(n) ? n : NaN;
}

interface NumProps { value: number; onChange: (v: number) => void; pct?: boolean; d?: number; min?: number; max?: number; className?: string; ariaLabel?: string; suffix?: string; width?: number }
/** Zahlenfeld mit deutscher Schreibweise. pct: Wert als Anteil (0,19) gespeichert, als 19 angezeigt. */
export function Num({ value, onChange, pct, d = 2, min, max, className, ariaLabel, suffix, width }: NumProps) {
  const show = (v: number) => fmtNum(pct ? Math.round(v * 1e6) / 1e4 : v, pct ? 2 : d);
  const [txt, setTxt] = useState(show(value));
  const [focus, setFocus] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => { if (!focus) setTxt(show(value)); }, [value, focus]);
  const commit = () => {
    const n = parseDE(txt);
    if (isNaN(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) { setErr(true); return; }
    setErr(false);
    const v = pct ? n / 100 : n;
    if (v !== value) onChange(v);
  };
  return (
    <span className={`num ${className ?? ''}`} style={width ? { width } : undefined}>
      <input inputMode="decimal" aria-label={ariaLabel} className={err ? 'err' : ''} value={txt}
        onFocus={e => { setFocus(true); e.target.select(); }} onBlur={() => { setFocus(false); commit(); }}
        onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      {(suffix ?? (pct ? '%' : '')) && <span className="suffix">{suffix ?? '%'}</span>}
    </span>
  );
}

export function Txt({ value, onChange, placeholder, ariaLabel, wide }: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string; wide?: boolean }) {
  return <input className={`txt ${wide ? 'wide' : ''}`} aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

export function Sel<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: [T, string][]; ariaLabel?: string }) {
  return <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value as T)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

export function Check({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return <label className="check"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /> <span>{label}</span></label>;
}

export function Tip({ text }: { text: string }) {
  return <span className="tip" tabIndex={0} aria-label={text} data-tip={text}>?</span>;
}

export function Field({ label, tip, children, hint }: { label: string; tip?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}{tip && <Tip text={tip} />}</label>
      <div className="control">{children}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Card({ title, children, actions, help }: { title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; help?: React.ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && <header><h3>{title}</h3><div className="actions">{actions}</div></header>}
      {help && <div className="help">{help}</div>}
      {children}
    </section>
  );
}

export function Help({ children }: { children: React.ReactNode }) {
  return <div className="explain"><span className="i">i</span><div>{children}</div></div>;
}
