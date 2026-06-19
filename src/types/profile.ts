export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface UserProfile {
  id: string;
  phone: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  gender: string;
  dob: string;          // "DD/MM/YYYY"
  locationCity: string;
  locationCountry: string;
  skinUndertone: string;
  colorSeason: ColorSeason | null;
  personalPalette: string[];
  onboardingComplete: boolean;
}

export class ProfileUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileUpdateError';
  }
}

export class AvatarUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarUploadError';
  }
}
