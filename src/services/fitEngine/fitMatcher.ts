import { BodyMeasurements, FitItem, ItemFitResult, FitPoint, FitCategory } from '../../types/fitEngine';

// Per-measurement-point ease thresholds.
// ideal = optimal comfort range; ok = acceptable range; below ok[0] = tight warning.
interface Thresholds { ideal: [number, number]; ok: [number, number] }

const THRESHOLDS: Record<string, Thresholds> = {
  chest:           { ideal: [2,  6],  ok: [0,  12] },
  shoulder_width:  { ideal: [0,  3],  ok: [-1,  5] },
  waist_top:       { ideal: [2,  6],  ok: [0,  10] },
  waist:           { ideal: [2,  6],  ok: [0,  10] },
  waist_outer:     { ideal: [4,  8],  ok: [0,  14] },
  hip:             { ideal: [4,  8],  ok: [0,  15] },
  upper_arm:       { ideal: [2,  5],  ok: [0,   8] },
  sleeves:         { ideal: [-1, 2],  ok: [-3,   4] },
  body_length:     { ideal: [0,  5],  ok: [-3,  10] },
  inseam:          { ideal: [-3, 2],  ok: [-6,   4] },
  thigh:           { ideal: [3,  8],  ok: [0,  14]  },
};

function easeScore(ease: number, t: Thresholds): number {
  if (ease < t.ok[0]) return 0.0;                          // tight / won't fit
  if (ease >= t.ideal[0] && ease <= t.ideal[1]) return 1.0; // ideal
  if (ease > t.ok[1]) return 0.2;                          // extremely oversized
  if (ease < t.ideal[0]) {
    // between ok[0] and ideal[0] — progressively better
    return 0.4 + 0.6 * ((ease - t.ok[0]) / (t.ideal[0] - t.ok[0] + 0.001));
  }
  // between ideal[1] and ok[1] — progressively worse (too roomy)
  return 0.7 + 0.3 * (1 - (ease - t.ideal[1]) / (t.ok[1] - t.ideal[1] + 0.001));
}

function fitCategory(ease: number): FitCategory {
  if (ease < 0)  return 'tight';
  if (ease < 2)  return 'snug';
  if (ease < 6)  return 'standard';
  if (ease < 12) return 'roomy';
  return 'oversized';
}

interface MappingEntry {
  bodyKey: keyof BodyMeasurements;
  garmentKey: string;
  thresholdKey: string;
  label: string;
}

const TOP_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_bust',             garmentKey: 'chest',          thresholdKey: 'chest',         label: 'Chest'        },
  { bodyKey: 'body_shoulder_width',   garmentKey: 'shoulder_width', thresholdKey: 'shoulder_width',label: 'Shoulder'     },
  { bodyKey: 'body_waist',            garmentKey: 'waist_top',      thresholdKey: 'waist_top',     label: 'Waist'        },
  { bodyKey: 'body_upper_arm',        garmentKey: 'upper_arm',      thresholdKey: 'upper_arm',     label: 'Upper arm'    },
  { bodyKey: 'body_sleeve_length',    garmentKey: 'sleeves',        thresholdKey: 'sleeves',       label: 'Sleeve length'},
  { bodyKey: 'body_upper_body_length',garmentKey: 'body_length',    thresholdKey: 'body_length',   label: 'Body length'  },
];

const PANTS_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_waist', garmentKey: 'waist',  thresholdKey: 'waist',  label: 'Waist'  },
  { bodyKey: 'body_hip',   garmentKey: 'hip',    thresholdKey: 'hip',    label: 'Hip'    },
  { bodyKey: 'body_inseam',garmentKey: 'inseam', thresholdKey: 'inseam', label: 'Inseam' },
  { bodyKey: 'body_thigh', garmentKey: 'thigh',  thresholdKey: 'thigh',  label: 'Thigh'  },
];

const OUTER_MAPPINGS: MappingEntry[] = [
  { bodyKey: 'body_bust',           garmentKey: 'chest',          thresholdKey: 'chest',         label: 'Chest'        },
  { bodyKey: 'body_shoulder_width', garmentKey: 'shoulder_width', thresholdKey: 'shoulder_width',label: 'Shoulder'     },
  { bodyKey: 'body_waist',          garmentKey: 'waist_outer',    thresholdKey: 'waist_outer',   label: 'Waist'        },
  { bodyKey: 'body_upper_arm',      garmentKey: 'upper_arm',      thresholdKey: 'upper_arm',     label: 'Upper arm'    },
  { bodyKey: 'body_sleeve_length',  garmentKey: 'sleeves',        thresholdKey: 'sleeves',       label: 'Sleeve length'},
];

function scoreMappings(
  body: BodyMeasurements,
  garment: Record<string, number | undefined>,
  mappings: MappingEntry[],
): FitPoint[] {
  const points: FitPoint[] = [];
  for (const m of mappings) {
    const bodyVal = body[m.bodyKey] as number | undefined;
    const garmentVal = garment[m.garmentKey];
    if (bodyVal == null || garmentVal == null) continue;
    const ease = garmentVal - bodyVal;
    const t = THRESHOLDS[m.thresholdKey];
    points.push({ key: m.label, ease, category: fitCategory(ease), score: easeScore(ease, t) });
  }
  return points;
}

export function scoreItemFit(item: FitItem, body: BodyMeasurements): ItemFitResult {
  if (!item.garmentMeasurements) {
    // No measurements — neutral score
    return { itemId: item.id, points: [], score: 0.5, warnings: [] };
  }

  const g = item.garmentMeasurements as Record<string, number | undefined>;
  let points: FitPoint[] = [];

  if (item.category === 'top')    points = scoreMappings(body, g, TOP_MAPPINGS);
  if (item.category === 'bottom') points = scoreMappings(body, g, PANTS_MAPPINGS);
  if (item.category === 'outwear')points = scoreMappings(body, g, OUTER_MAPPINGS);

  if (points.length === 0) return { itemId: item.id, points: [], score: 0.5, warnings: [] };

  const score = points.reduce((sum, p) => sum + p.score, 0) / points.length;
  const warnings = points.filter(p => p.category === 'tight').map(p => `${p.key} may be tight`);

  return { itemId: item.id, points, score, warnings };
}

export function scoreOutfitFit(items: FitItem[], body: BodyMeasurements): number {
  if (items.length === 0) return 0.5;
  const results = items.map(item => scoreItemFit(item, body));
  return results.reduce((sum, r) => sum + r.score, 0) / results.length;
}
