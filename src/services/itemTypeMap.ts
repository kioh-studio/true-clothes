// itemTypeMap — map coarse on-device image labels to a controlled garment type (feature 007).
// On-device labelers are generic ("Jacket", "Jeans", "Shoe"), so we keyword-map to the
// 40 controlled types and gate on confidence. Returns '' (user picks) when unsure —
// never a wild guess (controlled fields must never carry free text or a low-confidence type).

export interface ItemLabel { text: string; confidence: number }

// Ordered: first matching keyword wins. Specific before generic.
// Leading \b only (no trailing) so plurals/suffixes match: "Jeans", "Trousers", "Sneakers".
const LABEL_RULES: Array<[RegExp, string]> = [
  [/\b(tee|t-?shirt)/i, 'TEE'],
  [/\bpolo/i, 'POLO'],
  [/\b(sweater|jumper|pullover)/i, 'SWEATER'],
  [/\bcardigan/i, 'CARDIGAN'],
  [/\b(hoodie|sweatshirt)/i, 'HOODIE'],
  [/\b(knit|crewneck|turtleneck)/i, 'KNIT'],
  [/\bblouse/i, 'BLOUSE'],
  [/\b(waistcoat|gilet|\bvest)/i, 'VEST'],
  [/\bblazer/i, 'BLAZER'],
  [/\b(overcoat|trench)/i, 'OVERCOAT'],
  [/\b(parka|puffer)/i, 'PARKA'],
  [/\bcoat/i, 'COAT'],
  [/\b(jacket|windbreaker|bomber)/i, 'JACKET'],
  [/\bshirt/i, 'SHIRT'],
  [/\b(jean|denim)/i, 'JEANS'],
  [/\bchino/i, 'CHINOS'],
  [/\b(trouser|pant|slack)/i, 'TROUSERS'],
  [/\bshort/i, 'SHORTS'],
  [/\bskirt/i, 'SKIRT'],
  [/\bgown/i, 'GOWN'],
  [/\bjumpsuit/i, 'JUMPSUIT'],
  [/\b(overall|dungaree)/i, 'OVERALLS'],
  [/\bdress/i, 'DRESS'],
  [/\bloafer/i, 'LOAFERS'],
  [/\b(sneaker|trainer|plimsoll)/i, 'SNEAKERS'],
  [/\bboot/i, 'BOOTS'],
  [/\b(heel|stiletto|pump)/i, 'HEELS'],
  [/\b(sandal|flip.?flop)/i, 'SANDALS'],
  [/\b(oxford|brogue|derby)/i, 'OXFORDS'],
  [/\bmule/i, 'MULES'],
  [/\b(handbag|tote|backpack|purse|clutch|bag)/i, 'BAG'],
  [/\bbelt/i, 'BELT'],
  [/\bscarf/i, 'SCARF'],
  [/\bwatch/i, 'WATCH'],
  [/\bcap\b/i, 'CAP'],
  [/\b(necklace|pendant)/i, 'NECKLACE'],
  [/\b(sunglass|eyewear|glasses)/i, 'SUNGLASSES'],
  [/\b(hat|beanie|fedora)/i, 'HAT'],
  [/\bring\b/i, 'RING'],
  [/\b(bracelet|bangle)/i, 'BRACELET'],
  [/\b(shoe|footwear)/i, 'SNEAKERS'], // generic shoe -> safest common footwear
];

/**
 * Best controlled type for a set of labels, or '' if no confident match.
 * Considers labels at/above `minConfidence`, highest-confidence first.
 */
export function labelToType(labels: ItemLabel[] | undefined, minConfidence = 0.5): string {
  if (!labels?.length) return '';
  const sorted = [...labels].sort((a, b) => b.confidence - a.confidence);
  for (const { text, confidence } of sorted) {
    if (confidence < minConfidence) continue;
    for (const [re, type] of LABEL_RULES) {
      if (re.test(text)) return type;
    }
  }
  return '';
}
