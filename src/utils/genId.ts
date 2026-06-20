// RN-safe UUID v4.
//
// Hermes (React Native / Expo) has NO global `crypto.randomUUID`, so calling it
// throws "property 'crypto' doesn't exist". This helper uses `getRandomValues`
// when present (better entropy) and falls back to `Math.random` otherwise — the
// output is a valid RFC-4122 v4 UUID either way, so it is safe for the
// `clothing_items.id` (uuid) primary key and any client-side id.

export function genId(): string {
  const cryptoObj: Crypto | undefined = (globalThis as { crypto?: Crypto }).crypto;
  const bytes = new Uint8Array(16);

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const h: string[] = [];
  for (let i = 0; i < 16; i++) h.push(bytes[i].toString(16).padStart(2, '0'));

  return (
    `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-` +
    `${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
  );
}
