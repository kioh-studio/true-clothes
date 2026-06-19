// Wizard domain types (feature 006-ai-item-extraction).

import { LogoSignal, MKey } from '../../types/fitEngine';

export type WizardStep = 'upload' | 'analyse' | 'review' | 'done';
export type ExtractMethod = 'ai' | 'item';

// One source photo the user added, with its chosen extraction method + optional note.
export interface PhotoEntry {
  id: string;            // local id
  uri: string;           // local file uri of the source photo
  method: ExtractMethod; // 'ai' (Gemini) | 'item' (on-device, extract-by-item)
  note: string;          // per-photo enrichment note (untrusted)
}

// One detected garment, editable in Review. Controlled vocab + UI fields.
export interface ExtractedItem {
  id: string;
  srcId: string;                 // PhotoEntry.id it came from (Review groups by this)
  method: ExtractMethod;
  localImageUri: string | null;  // isolated product image (or null → placeholder)
  type: string;                  // controlled (UPPERCASE)
  name: string;
  color: string;                 // controlled (Title Case)
  material: string | null;
  fit: string | null;
  pattern: string | null;
  warmthSeason: string | null;
  measurements: Partial<Record<MKey, number>>;
  brand: string;
  link: string;
  tags: string[];
  graphics: LogoSignal | null;   // captured, no edit UI in MVP
  confidence: number;
  usedFallback?: boolean;        // on-device item: cut-out couldn't be isolated cleanly (UI hint)
}
