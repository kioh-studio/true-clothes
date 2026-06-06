import { FitItem, ColorGrade, BannedFeature } from '../../types/fitEngine';
import { StyleConfig } from '../../types/fitEngine';

// ─── Style Hard Constraints ─────────────────────────────────────────────────
// Applies the active style's hard constraints to DELETE non-matching items
// from the wardrobe BEFORE candidate generation. Items that survive become
// the pool from which outfits are assembled.
//
// This implements the design brief's key principle:
//   "Separate rules that DELETE options from rules that RANK options."

export interface FilterResult {
  /** Items that passed all hard constraints */
  passed: FitItem[];
  /** Items that were rejected, with reasons (for UI explanation layer) */
  rejected: Array<{ item: FitItem; reasons: string[] }>;
}

/** Check if an item's color is allowed by the style palette */
function colorPasses(item: FitItem, config: StyleConfig): string | null {
  const grade = config.palette[item.colorProfile.primaryColor];
  // If color not in palette map at all, it's implicitly allowed
  if (!grade) return null;
  if (grade === 'banned') {
    return `${item.colorProfile.primaryColor} is not in the ${config.name} palette`;
  }
  // perfect, allowed, accent all pass the hard filter
  // (accent is scored lower in soft scoring, not deleted)
  return null;
}

/** Check if an item's fabric is allowed */
function fabricPasses(item: FitItem, config: StyleConfig): string | null {
  if (!item.fabricName) return null;

  if (config.fabricsBanned.length > 0 && config.fabricsBanned.includes(item.fabricName)) {
    return `${item.fabricName} fabric is banned in ${config.name}`;
  }
  if (config.fabricsAllowed.length > 0 && !config.fabricsAllowed.includes(item.fabricName)) {
    return `${item.fabricName} fabric is not in the ${config.name} allowed list`;
  }
  return null;
}

/** Check if an item's fit is allowed */
function fitPasses(item: FitItem, config: StyleConfig): string | null {
  if (config.allowedFits.length === 0) return null;
  if (!config.allowedFits.includes(item.fit)) {
    return `${item.fit} fit is not allowed in ${config.name} (requires ${config.allowedFits.join('/')})`;
  }
  return null;
}

/** Check if an item's formality is within range */
function formalityPasses(item: FitItem, config: StyleConfig): string | null {
  const [min, max] = config.formalityRange;
  if (item.formality < min - 0.5 || item.formality > max + 0.5) {
    return `formality ${item.formality.toFixed(1)} is outside ${config.name} range [${min}–${max}]`;
  }
  return null;
}

/** Check if an item has banned features */
function featuresPasses(item: FitItem, config: StyleConfig): string | null {
  if (config.bannedFeatures.length === 0) return null;

  const features: BannedFeature[] = [];

  // Check graphic weight
  if (item.graphics.graphicWeight === 'large_graphic' || item.graphics.graphicWeight === 'full_print') {
    if (config.bannedFeatures.includes('loud_logo')) features.push('loud_logo');
    if (config.bannedFeatures.includes('full_print') && item.graphics.graphicWeight === 'full_print') {
      features.push('full_print');
    }
  }
  if (item.graphics.artworkType === 'brand_logo' && item.graphics.graphicWeight !== 'none' &&
      item.graphics.graphicWeight !== 'small_logo' && config.bannedFeatures.includes('loud_logo')) {
    features.push('loud_logo');
  }

  // Check pattern
  if (item.fabric.pattern !== 'solid' && item.fabric.pattern !== 'checkered' && item.fabric.pattern !== 'striped') {
    if (config.bannedFeatures.includes('macro_print')) features.push('macro_print');
  }

  // Check vivid/neon colors
  if (item.colorProfile.colorSaturation === 'vivid' && config.bannedFeatures.includes('neon_color')) {
    const neonColors = new Set(['yellow', 'orange', 'green', 'pink']);
    if (neonColors.has(item.colorProfile.primaryColor)) {
      features.push('neon_color');
    }
  }

  if (features.length > 0) {
    return `has banned features for ${config.name}: ${features.join(', ')}`;
  }
  return null;
}

// ─── Main filter ────────────────────────────────────────────────────────────

export function filterByStyle(
  items: FitItem[],
  config: StyleConfig,
): FilterResult {
  const passed: FitItem[] = [];
  const rejected: FilterResult['rejected'] = [];

  for (const item of items) {
    const reasons: string[] = [];

    const colorResult = colorPasses(item, config);
    if (colorResult) reasons.push(colorResult);

    const fabricResult = fabricPasses(item, config);
    if (fabricResult) reasons.push(fabricResult);

    const fitResult = fitPasses(item, config);
    if (fitResult) reasons.push(fitResult);

    const formalityResult = formalityPasses(item, config);
    if (formalityResult) reasons.push(formalityResult);

    const featuresResult = featuresPasses(item, config);
    if (featuresResult) reasons.push(featuresResult);

    if (reasons.length === 0) {
      passed.push(item);
    } else {
      rejected.push({ item, reasons });
    }
  }

  // Safety: if filtering removed too many items from a required category,
  // relax constraints by keeping the "least bad" rejected items.
  // This prevents empty feeds when the wardrobe doesn't match the style well.
  const categories = ['top', 'bottom', 'shoes'] as const;
  for (const cat of categories) {
    const catItems = passed.filter(i => i.category === cat);
    if (catItems.length === 0) {
      // Find rejected items in this category, sorted by fewest violations
      const rejectedInCat = rejected
        .filter(r => r.item.category === cat)
        .sort((a, b) => a.reasons.length - b.reasons.length);

      // Add back the least-violating items (up to 3)
      const toRestore = rejectedInCat.slice(0, 3);
      for (const r of toRestore) {
        passed.push(r.item);
        const idx = rejected.indexOf(r);
        if (idx >= 0) rejected.splice(idx, 1);
      }
    }
  }

  return { passed, rejected };
}
