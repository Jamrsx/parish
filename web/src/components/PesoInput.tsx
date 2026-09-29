import { useLayoutEffect, useRef } from "react";
import { formatPesoDisplay, sanitizePesoInput } from "../../library/pesoInput";

interface PesoInputProps {
  /** Raw value without commas, e.g. "2000" or "2000.50" */
  value: string;
  onChange: (raw: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
  /** Pad to 2 decimals when the field loses focus (2000 → 2,000.00). */
  padOnBlur?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const countSignificant = (text: string) => text.replace(/[^0-9.]/g, "").length;

export default function PesoInput({
  value,
  onChange,
  id,
  placeholder = "0.00",
  disabled,
  className = "",
  hasError,
  padOnBlur = true,
  ...aria
}: PesoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretSignificant = useRef<number | null>(null);
  const display = formatPesoDisplay(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const target = caretSignificant.current;
    if (!input || target === null || document.activeElement !== input) return;

    let pos = 0;
    let seen = 0;
    while (pos < display.length && seen < target) {
      if (/[0-9.]/.test(display[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);
    caretSignificant.current = null;
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    const caret = e.target.selectionStart ?? typed.length;
    const raw = sanitizePesoInput(typed);
    let caretCount = countSignificant(typed.slice(0, caret));
    if (typed.replace(/[^0-9.]/g, "").startsWith(".") && raw.startsWith("0.")) {
      caretCount += 1;
    }
    caretSignificant.current = caretCount;

    console.log("[PesoInput]", { typed, raw, display: formatPesoDisplay(raw) });
    onChange(raw);
  };

  const handleBlur = () => {
    if (!padOnBlur || !value) return;
    const n = Number(value);
    if (Number.isFinite(n)) {
      const padded = n.toFixed(2);
      if (padded !== value) onChange(padded);
    }
  };

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
        aria-hidden
      >
        ₱
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 ${
          hasError ? "border-red-400" : "border-slate-200"
        } ${className}`}
        {...aria}
      />
    </div>
  );
}
