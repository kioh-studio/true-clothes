import { labelToType } from '../itemTypeMap';

describe('labelToType', () => {
  it('maps confident garment labels to controlled types', () => {
    expect(labelToType([{ text: 'Blue Jeans', confidence: 0.9 }])).toBe('JEANS');
    expect(labelToType([{ text: 'Sneaker', confidence: 0.8 }])).toBe('SNEAKERS');
    expect(labelToType([{ text: 'Leather jacket', confidence: 0.7 }])).toBe('JACKET');
    expect(labelToType([{ text: 'Handbag', confidence: 0.95 }])).toBe('BAG');
  });

  it('returns empty (user picks) when below confidence threshold', () => {
    expect(labelToType([{ text: 'Jeans', confidence: 0.3 }])).toBe('');
  });

  it('returns empty when no label maps to a controlled type', () => {
    expect(labelToType([{ text: 'Furniture', confidence: 0.9 }])).toBe('');
    expect(labelToType([])).toBe('');
    expect(labelToType(undefined)).toBe('');
  });

  it('prefers the highest-confidence mappable label', () => {
    expect(labelToType([
      { text: 'Clothing', confidence: 0.99 },  // no rule
      { text: 'Trousers', confidence: 0.6 },   // maps
    ])).toBe('TROUSERS');
  });
});
