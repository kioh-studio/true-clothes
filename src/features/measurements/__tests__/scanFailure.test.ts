import {
  buildRetake, guidanceKeys, isLowStorage, lowStorageThreshold, LOW_STORAGE_CAP_BYTES,
} from '../scanFailure';

const MB = 1024 * 1024;

describe('retake reasons', () => {
  it('dedupes and orders by priority', () => {
    expect(buildRetake(['error', 'mask', 'cropped', 'mask', 'storage']).reasons)
      .toEqual(['storage', 'cropped', 'mask', 'error']);
  });
  it('empty falls back to error', () => {
    expect(buildRetake([]).reasons).toEqual(['error']);
  });
  it('shows at most 2 guidance keys, top priority first', () => {
    expect(guidanceKeys(['mask', 'no_person', 'cropped'])).toEqual([
      'measurementsScan_retake_cropped', 'measurementsScan_retake_no_person',
    ]);
  });
});

describe('low storage rule = min(10% total, 500MB)', () => {
  it('caps at 500MB on big disks', () => {
    expect(lowStorageThreshold(128 * 1024 * MB)).toBe(LOW_STORAGE_CAP_BYTES);
  });
  it('uses 10% on small disks', () => {
    expect(lowStorageThreshold(2000 * MB)).toBe(200 * MB);
  });
  it('falls back to 500MB when total unknown', () => {
    expect(lowStorageThreshold(null)).toBe(LOW_STORAGE_CAP_BYTES);
  });
  it('342MB free of 128GB is low; unknown free is not', () => {
    expect(isLowStorage(342 * MB, 128 * 1024 * MB)).toBe(true);
    expect(isLowStorage(600 * MB, 128 * 1024 * MB)).toBe(false);
    expect(isLowStorage(undefined, 128 * 1024 * MB)).toBe(false);
  });
});
