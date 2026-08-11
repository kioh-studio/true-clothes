// classifyTryOnFailure — distinguishes an AI-service-side failure (the edge
// function reached Gemini and got an error back) from a genuine network
// failure (the request never reached the server) for the try-on validate/
// generate error copy. See backlog "L. Gemini prepay credits CẠN" (2026-08-07):
// a Gemini 429 surfaced as tryon-validate's 502 and told a user with a fine
// connection to "check your connection" — this classifier is what fixed it.
//
// Only tryOnWearService's dependencies need stubbing to import the module
// under plain ts-jest (no jest-expo preset here) — the classifier itself is
// a pure function of `error.name` and needs no supabase/expo mocking beyond
// what's required for the module to load.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/doc/',
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => 'base64data'),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'opt://x' })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('../supabase', () => ({ sb: { functions: { invoke: jest.fn() } } }));
jest.mock('../itemPhotoService', () => ({ signedUrl: jest.fn(async () => 'https://signed/x') }));

import { classifyTryOnFailure } from '../tryOnWearService';

describe('classifyTryOnFailure', () => {
  it('classifies FunctionsFetchError (fetch never reached the server) as network', () => {
    expect(classifyTryOnFailure({ name: 'FunctionsFetchError', message: 'fetch failed' })).toBe('network');
  });

  it('classifies FunctionsHttpError (server responded with a non-2xx status) as service', () => {
    // This is the exact shape hit in the 2026-08-07 incident: tryon-validate
    // returned 502 because Gemini itself errored (429 RESOURCE_EXHAUSTED).
    expect(classifyTryOnFailure({ name: 'FunctionsHttpError', context: { status: 502 } })).toBe('service');
  });

  it('classifies FunctionsRelayError as service', () => {
    expect(classifyTryOnFailure({ name: 'FunctionsRelayError', context: {} })).toBe('service');
  });

  it('falls back to unknown for an unrelated error (e.g. a local image-manipulation failure)', () => {
    expect(classifyTryOnFailure(new Error('manipulateAsync failed'))).toBe('unknown');
  });

  it('falls back to unknown for null/undefined/non-object input without throwing', () => {
    expect(classifyTryOnFailure(null)).toBe('unknown');
    expect(classifyTryOnFailure(undefined)).toBe('unknown');
    expect(classifyTryOnFailure('plain string')).toBe('unknown');
  });
});
