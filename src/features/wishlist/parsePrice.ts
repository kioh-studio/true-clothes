// Price field parser: empty -> null (clear), invalid/negative -> undefined (ignore).
export function parsePrice(text: string): number | null | undefined {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
