import { LocaleFlavor } from "../types";

export function detectLocale(): LocaleFlavor {
  const lang = navigator.language?.toLowerCase() ?? "en";
  return lang.startsWith("de") ? "de" : "en";
}

export function decimalSeparator(loc: LocaleFlavor) {
  return loc === "de" ? "," : ".";
}

export function formatNumber(n: number, loc: LocaleFlavor) {
  return new Intl.NumberFormat(loc === "de" ? "de-DE" : "en-US", {
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Robust parse: accepts "30", "30,5", "30.5", "1 234,5", "1 234.5" (with NBSPs/spaces).
 * Returns null if not a valid number.
 */
export function parseLocaleNumber(input: string, loc: LocaleFlavor): number | null {
  if (input == null) return null;

  const cleaned = String(input)
    .trim()
    .replace(/[\s\u00A0\u202F]/g, ""); // spaces & NBSPs

  if (!cleaned) return null;

  const sep = decimalSeparator(loc);
  const other = sep === "," ? "." : ",";

  const unified = cleaned
    .replace(new RegExp("\\" + other, "g"), sep) // unify to locale sep
    .replace(new RegExp("\\" + sep, "g"), ".");  // then to dot

  const n = Number(unified);
  return Number.isFinite(n) ? n : null;
}
