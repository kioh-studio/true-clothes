// Price field parser: empty -> null (clear), invalid/negative -> undefined (ignore).
export function parsePrice(text: string): number | null | undefined {
  const s = text.replace(/\s/g, '');
  if (!s) return null;
  // Thousands grouping ("1.500.000", "150.000", "1,500,000", "1.500,50"): every
  // separator followed by exactly 3 digits is a group separator; a trailing
  // 1–2 digit group is the decimal part. Otherwise "12,5"/"12.5" are decimals.
  const grouped = /^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(s);
  const norm = (grouped ? s.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '') : s).replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
