const MAX_INTEGER_DIGITS = 10;

/** Keeps digits and a single decimal point (max 2 decimals). Returns a raw value without commas, e.g. "2000.5". */
export const sanitizePesoInput = (input: string, maxIntegerDigits = MAX_INTEGER_DIGITS): string => {
  let cleaned = input.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }

  const [rawInt = "", rawDec] = cleaned.split(".");
  const intPart = rawInt.replace(/^0+(?=\d)/, "").slice(0, maxIntegerDigits);

  if (rawDec !== undefined) {
    return `${intPart || "0"}.${rawDec.slice(0, 2)}`;
  }
  return intPart;
};

/** "1234567.5" → "1,234,567.5" (display only). */
export const formatPesoDisplay = (raw: string): string => {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
};

/** Convert a numeric API value into the raw string PesoInput expects. */
export const toPesoInputValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "";
};
