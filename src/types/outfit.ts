export interface OutfitInteraction {
  id: string;
  userId: string;
  outfitId: string;
  type: 'saved' | 'worn' | 'scheduled' | 'impression';
  outfitData: Record<string, unknown> | null;
  wornAt: string | null;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export class OutfitInteractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OutfitInteractionError';
  }
}
