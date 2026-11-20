import { cropResizeRgba, type RgbaImage } from '../rgbaImage';

function make(w: number, h: number, f: (x: number, y: number) => number): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = f(x, y); data[i + 1] = 255 - f(x, y); data[i + 2] = 7; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('cropResizeRgba', () => {
  it('same-size resize is byte-identical', () => {
    const img = make(8, 6, (x, y) => x * 13 + y * 7);
    expect(Array.from(cropResizeRgba(img, null, 8, 6).data)).toEqual(Array.from(img.data));
  });

  it('2x downscale of a horizontal gradient averages neighbour pairs', () => {
    const img = make(4, 2, (x) => x * 10); // 0,10,20,30
    const out = cropResizeRgba(img, null, 2, 1);
    expect(out.data[0]).toBe(5);   // (0+10)/2
    expect(out.data[4]).toBe(25);  // (20+30)/2
  });

  it('crop offset selects the right region', () => {
    const img = make(10, 10, (x, y) => x * 10 + y);
    const out = cropResizeRgba(img, { originX: 3, originY: 4, width: 2, height: 2 }, 2, 2);
    expect(out.data[0]).toBe(34);       // (3,4)
    expect(out.data[4]).toBe(44);       // (4,4)
    expect(out.data[8]).toBe(35);       // (3,5)
  });

  it('upscale clamps at the crop edges (no read outside the crop)', () => {
    const img = make(10, 1, (x) => x * 10);
    const out = cropResizeRgba(img, { originX: 2, originY: 0, width: 2, height: 1 }, 4, 1);
    expect(out.data[0]).toBe(20);       // left clamp = crop pixel 0 (not pixel 1 of the image)
    expect(out.data[12]).toBe(30);      // right clamp = crop pixel 1 (not pixel 4)
    for (let i = 0; i < 4; i++) expect(out.data[i * 4]).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < 4; i++) expect(out.data[i * 4]).toBeLessThanOrEqual(30);
  });
});
