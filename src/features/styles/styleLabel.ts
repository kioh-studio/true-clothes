import { STYLES } from '../../data';

// Localized style names/descriptions. Copy lives in i18n (`style_<id>_name|desc`);
// DB/static text is only the fallback, so unknown or new styles keep working.
// Display-only: nothing stored or sent to the server changes.
type TFn = (key: string, opts?: { defaultValue?: string }) => string;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// 'OLDMONEY' / 'Old Money' / 'Parisian Chic' / 'oldmoney' -> style id
const ID_BY_NORM = new Map<string, string>();
for (const s of STYLES) {
  ID_BY_NORM.set(norm(s.id), s.id);
  ID_BY_NORM.set(norm(s.name), s.id);
}

export function styleName(id: string, fallback: string, t: TFn): string {
  return t(`style_${id}_name`, { defaultValue: fallback });
}

export function styleDesc(id: string, fallback: string, t: TFn): string {
  return t(`style_${id}_desc`, { defaultValue: fallback });
}

/** For strings that may be an id, a display name or an upper-cased id (e.g.
 *  `outfit.style`, server `styleTag`). Unknown values (e.g. 'CUSTOM') pass through. */
export function styleLabelFromAny(raw: string | undefined | null, t: TFn): string {
  if (!raw) return '';
  const id = ID_BY_NORM.get(norm(raw));
  return id ? styleName(id, raw, t) : raw;
}
