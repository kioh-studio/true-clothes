// analytics — guarded no-op behaviour with no key, and the privacy scrubber.
// See src/services/analytics.ts for why this is the only file allowed to
// import posthog-react-native (mocked here so the real native module is
// never touched under plain ts-jest).

const mockCapture = jest.fn();
const mockScreen = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    screen: mockScreen,
    identify: mockIdentify,
    reset: mockReset,
  })),
}));

describe('analytics — no key set (EXPO_PUBLIC_POSTHOG_KEY unset)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env['EXPO_PUBLIC_POSTHOG_KEY'];
  });

  it('track/screen/identify/resetAnalytics never throw and never call PostHog', () => {
    const analytics = require('../analytics');
    expect(() => analytics.track('feedback_submitted', { kind: 'bug' })).not.toThrow();
    expect(() => analytics.screen('outfit/[id]')).not.toThrow();
    expect(() => analytics.identify('user-123')).not.toThrow();
    expect(() => analytics.resetAnalytics()).not.toThrow();

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockScreen).not.toHaveBeenCalled();
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('scrubProps', () => {
  it('drops forbidden keys and keeps allowed ones', () => {
    const { scrubProps } = require('../analytics');
    const result = scrubProps({
      kind: 'bug',
      method: 'photo',
      source: 'wardrobe-report',
      body_height: 170,
      measurements: 'x',
      photoUri: 'file://x.jpg',
      image_url: 'https://x',
      skinTone: 'warm',
      hairColor: 'black',
      undertone: 'cool',
      email: 'a@b.com',
      phoneNumber: '123',
      userName: 'khoi',
      message: 'free text',
      bodyText: 'more free text',
    });
    expect(result).toEqual({
      kind: 'bug',
      method: 'photo',
      source: 'wardrobe-report',
    });
  });

  it('passes through undefined unchanged', () => {
    const { scrubProps } = require('../analytics');
    expect(scrubProps(undefined)).toBeUndefined();
  });
});
