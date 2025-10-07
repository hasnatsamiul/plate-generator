import { useEffect, useRef, useState } from "react";
import type { LocaleFlavor } from "../types";
import { formatNumber, parseLocaleNumber } from "../utils/locale";

type Props = {
  label: string;
  value: number;
  onCommit: (n: number) => void;  // only called with valid values
  min: number;
  max: number;
  loc: LocaleFlavor;
  unit?: string;
};

export default function NumberField({
  label, value, onCommit, min, max, loc, unit = "cm"
}: Props) {
  const prevGood = useRef(value);
  const [draft, setDraft] = useState(() => formatNumber(value, loc));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prevGood.current = value;
    setDraft(formatNumber(value, loc));
    setError(null);
  }, [value, loc]);

  function validate(n: number) {
    if (n < min || n > max) return `Must be between ${min} and ${max} ${unit}.`;
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
    setError(null); // don't block while typing
  }

  function handleBlur() {
    const parsed = parseLocaleNumber(draft, loc);
    if (parsed == null) {
      setDraft(formatNumber(prevGood.current, loc));
      setError("Not a number.");
      return;
    }
    const err = validate(parsed);
    if (err) {
      setDraft(formatNumber(prevGood.current, loc));
      setError(err);
      return;
    }
    if (parsed !== prevGood.current) {
      onCommit(Number(parsed.toFixed(1)));
    } else {
      setDraft(formatNumber(prevGood.current, loc)); // normalize display
    }
  }

  return (
    <div className="nf">
      <div className="nf-row">
        <label className="nf-label">{label}</label>
        <div className={`nf-input ${error ? "nf-bad" : ""}`}>
          <input
            inputMode="decimal"
            value={draft}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // commit same as blur, then remove focus
                handleBlur();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            aria-invalid={!!error}
          />
          <span className="nf-unit">{unit}</span>
        </div>
      </div>
      <div className="nf-hint">{Math.round(Number(prevGood.current) * 10)} mm</div>
      {error && <div className="nf-err">{error}</div>}
    </div>
  );
}
