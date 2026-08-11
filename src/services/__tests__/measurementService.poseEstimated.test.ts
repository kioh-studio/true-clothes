// poseEstimated mapper round-trip (2026-08-11): the DB column
// `body_measurements.pose_estimated` is NOT NULL DEFAULT false, but nothing
// in the app ever set it to true — see plan.md "poseEstimated provenance
// fix" and backlog.md. Fixed at the useMeasurements.ts / measurements-edit.tsx
// save boundary (not covered here, no pure seam without hook-render infra);
// this test locks down the pure mapper seam that DOES exist —
// measurementService's bodyToRow/rowToBody via the public upsert/fetch API —
// so a future edit to that mapper can't silently reintroduce the bug (e.g.
// collapsing `false` to "omit", which would make a genuine manual-entry save
// stop clearing a stale `true` from a previous scan).

jest.mock('../supabase', () => {
  let capturedUpsert: Record<string, unknown> | null = null;
  let mockRow: Record<string, unknown> | null = null;
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: mockRow, error: null }),
    upsert: async (payload: Record<string, unknown>) => {
      capturedUpsert = payload;
      return { error: null };
    },
  });
  return {
    sb: { from: () => builder },
    __getCapturedUpsert: () => capturedUpsert,
    __setMockRow: (r: Record<string, unknown> | null) => { mockRow = r; },
  };
});

import { fetchMyMeasurements, upsertMyMeasurements } from '../measurementService';
import * as supabaseMock from '../supabase';

const { __getCapturedUpsert, __setMockRow } = supabaseMock as unknown as {
  __getCapturedUpsert: () => Record<string, unknown> | null;
  __setMockRow: (r: Record<string, unknown> | null) => void;
};

function fullNullRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    user_id: 'u1',
    body_height: null, body_weight: null, body_bust: null, body_waist: null, body_hip: null,
    body_inseam: null, body_thigh: null, body_rise: null, body_shoulder_width: null,
    body_sleeve_length: null, body_upper_body_length: null, body_upper_arm: null,
    body_neck: null, body_foot_length: null, body_foot_width: null,
    preferred_fit: null, body_shape: null,
    pose_estimated: false, measurements_consent: false,
    ...overrides,
  };
}

describe('measurementService — poseEstimated provenance mapper', () => {
  beforeEach(() => __setMockRow(null));

  it('upsert: poseEstimated=true is written as pose_estimated: true', async () => {
    await upsertMyMeasurements('u1', { poseEstimated: true });
    expect(__getCapturedUpsert()).toMatchObject({ pose_estimated: true });
  });

  it('upsert: poseEstimated=false is written as pose_estimated: false (an explicit clear, not omitted)', async () => {
    await upsertMyMeasurements('u1', { poseEstimated: false });
    expect(__getCapturedUpsert()).toMatchObject({ pose_estimated: false });
  });

  it('upsert: poseEstimated omitted (undefined) is not written at all — "don\'t touch" semantics', async () => {
    await upsertMyMeasurements('u1', { body_height: 170 });
    const captured = __getCapturedUpsert();
    expect(captured).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(captured, 'pose_estimated')).toBe(false);
  });

  it('fetch: pose_estimated=true on the row maps to poseEstimated: true', async () => {
    __setMockRow(fullNullRow({ pose_estimated: true }));
    const result = await fetchMyMeasurements('u1');
    expect(result?.poseEstimated).toBe(true);
  });

  it('fetch: pose_estimated=false on the row maps to poseEstimated: false', async () => {
    __setMockRow(fullNullRow({ pose_estimated: false }));
    const result = await fetchMyMeasurements('u1');
    expect(result?.poseEstimated).toBe(false);
  });
});
