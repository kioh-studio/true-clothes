export interface IntentContext {
  rawPrompt: string;
  turnCount: number;
  occasion?: string;
  mood?: string;
  colorPreference?: string;
}

export function createEmptyIntent(): IntentContext {
  return { rawPrompt: '', turnCount: 0 };
}
