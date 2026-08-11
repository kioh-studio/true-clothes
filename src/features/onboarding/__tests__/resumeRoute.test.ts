import { resolveOnboardingResumeRoute, OnboardingProgressSnapshot } from '../resumeRoute';

const FULL: OnboardingProgressSnapshot = {
  gender: 'WOMAN',
  dob: '01/01/1990',
  location: 'Hanoi, Vietnam',
  bodyHeight: 165,
  bodyWeight: 55,
  selectedStyles: ['minimalist'],
  colorPreferences: ['Black'],
};

describe('resolveOnboardingResumeRoute', () => {
  it('resumes at basics when neither gender nor dob is on file', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, gender: '', dob: '' })).toBe('/(onboarding)/basics');
  });

  it('treats gender alone as basics having been visited', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, gender: 'WOMAN', dob: '', location: '' }))
      .toBe('/(onboarding)/location');
  });

  it('treats dob alone as basics having been visited', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, gender: '', dob: '01/01/1990', location: '' }))
      .toBe('/(onboarding)/location');
  });

  it('resumes at location when basics is done but location is blank', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, location: '' })).toBe('/(onboarding)/location');
  });

  it('resumes at location when location is only whitespace', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, location: '   ' })).toBe('/(onboarding)/location');
  });

  it('resumes at measurements when height is missing', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, bodyHeight: null })).toBe('/(onboarding)/measurements');
  });

  it('resumes at measurements when weight is missing', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, bodyWeight: undefined })).toBe('/(onboarding)/measurements');
  });

  it('resumes at styles when no style is selected yet', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, selectedStyles: [] })).toBe('/(onboarding)/styles');
  });

  it('resumes at colors when styles is done but no color preference is on file', () => {
    expect(resolveOnboardingResumeRoute({ ...FULL, colorPreferences: [] })).toBe('/(onboarding)/colors');
  });

  it('resumes at complete when every step has data but onboarding was never marked complete', () => {
    expect(resolveOnboardingResumeRoute(FULL)).toBe('/(onboarding)/complete');
  });

  it('checks steps in order — an earlier gap wins even if later ones are also empty', () => {
    expect(resolveOnboardingResumeRoute({
      ...FULL, location: '', bodyHeight: null, selectedStyles: [], colorPreferences: [],
    })).toBe('/(onboarding)/location');
  });
});
