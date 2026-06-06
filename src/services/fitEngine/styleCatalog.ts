import { StyleDef } from '../../types/fitEngine';

// Style definitions with attribute vectors and curated relationship graph.
// Styles match the IDs in src/data/index.ts STYLES.

export const STYLE_CATALOG: StyleDef[] = [
  {
    id: 'oldmoney',
    name: 'Old Money',
    popularity: 0.748,
    attributes: {
      formality: 4.5,
      colorPalette: ['neutral', 'earth', 'monochrome'],
      silhouette: ['tailored', 'structured'],
      patternLevel: 1.5,
      textureRichness: 3.0,
      mood: ['serious', 'clean'],
    },
    neighbors: [
      { styleId: 'minimalist', weight: 0.8 },
      { styleId: 'preppy',     weight: 0.8 },
      { styleId: 'smartcasual',weight: 0.6 },
    ],
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    popularity: 0.568,
    attributes: {
      formality: 3.5,
      colorPalette: ['neutral', 'monochrome', 'dark'],
      silhouette: ['tailored', 'relaxed'],
      patternLevel: 1.0,
      textureRichness: 1.5,
      mood: ['clean', 'serious'],
    },
    neighbors: [
      { styleId: 'oldmoney',   weight: 0.8 },
      { styleId: 'smartcasual',weight: 0.7 },
    ],
  },
  {
    id: 'streetwear',
    name: 'Streetwear',
    popularity: 0.504,
    attributes: {
      formality: 2.0,
      colorPalette: ['bold', 'dark'],
      silhouette: ['oversized', 'relaxed'],
      patternLevel: 2.5,
      textureRichness: 1.5,
      mood: ['playful', 'edgy'],
    },
    neighbors: [
      { styleId: 'athleisure', weight: 0.7 },
      { styleId: 'y2k',        weight: 0.6 },
    ],
  },
  {
    id: 'smartcasual',
    name: 'Smart Casual',
    popularity: 0.750,
    attributes: {
      formality: 3.0,
      colorPalette: ['neutral', 'earth'],
      silhouette: ['structured', 'relaxed'],
      patternLevel: 1.5,
      textureRichness: 2.0,
      mood: ['clean', 'serious'],
    },
    neighbors: [
      { styleId: 'oldmoney',   weight: 0.6 },
      { styleId: 'minimalist', weight: 0.7 },
      { styleId: 'preppy',     weight: 0.8 },
    ],
  },
  {
    id: 'preppy',
    name: 'Preppy',
    popularity: 0.500,
    attributes: {
      formality: 3.5,
      colorPalette: ['neutral', 'pastel'],
      silhouette: ['structured', 'tailored'],
      patternLevel: 2.5,
      textureRichness: 2.0,
      mood: ['clean', 'playful'],
    },
    neighbors: [
      { styleId: 'oldmoney',   weight: 0.8 },
      { styleId: 'smartcasual',weight: 0.8 },
    ],
  },
  {
    id: 'athleisure',
    name: 'Athleisure',
    popularity: 0.724,
    attributes: {
      formality: 1.5,
      colorPalette: ['bold', 'neutral'],
      silhouette: ['relaxed', 'oversized'],
      patternLevel: 1.5,
      textureRichness: 1.0,
      mood: ['playful'],
    },
    neighbors: [
      { styleId: 'streetwear', weight: 0.7 },
      { styleId: 'y2k',        weight: 0.4 },
    ],
  },
  {
    id: 'y2k',
    name: 'Y2K',
    popularity: 0.400,
    attributes: {
      formality: 1.5,
      colorPalette: ['bold', 'pastel'],
      silhouette: ['bodycon', 'oversized'],
      patternLevel: 4.0,
      textureRichness: 2.0,
      mood: ['playful', 'edgy'],
    },
    neighbors: [
      { styleId: 'streetwear', weight: 0.6 },
      { styleId: 'athleisure', weight: 0.4 },
    ],
  },
  {
    id: 'bohemian',
    name: 'Bohemian',
    popularity: 0.402,
    attributes: {
      formality: 2.0,
      colorPalette: ['earth', 'bold'],
      silhouette: ['relaxed', 'oversized'],
      patternLevel: 3.5,
      textureRichness: 4.0,
      mood: ['romantic', 'artistic'],
    },
    neighbors: [
      { styleId: 'y2k',        weight: 0.3 },
      { styleId: 'athleisure', weight: 0.2 },
    ],
  },
];

export const styleById = (id: string): StyleDef | undefined =>
  STYLE_CATALOG.find(s => s.id === id);
