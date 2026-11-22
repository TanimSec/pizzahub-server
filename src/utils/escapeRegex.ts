const SPECIAL = new Set(".*+?^${}()|[]".split("").concat(String.fromCharCode(92)));

export const escapeRegex = (s: string): string =>
  Array.from(s, (ch) => (SPECIAL.has(ch) ? String.fromCharCode(92) + ch : ch)).join("");
