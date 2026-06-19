// collage.jsx — Editorial flat-lay outfit collage + AI try-on sheet
// Renders an outfit as floating item cutouts on a cream background,
// arranged in a magazine-style mood board.

// ─── Item role categorization ───
// Per user spec — anchor is the largest piece (full-length item or the bottom).
// Secondaries are tops / mid-layers (visible outer first, then inner).
// Accessories sit on a smaller bottom row.
const ANCHOR_PRIORITY = ['DRESS', 'OVERCOAT', 'COAT', 'JEANS', 'TROUSERS', 'CHINOS', 'SKIRT', 'BLAZER'];
const OUTER_TOPS      = new Set(['BLAZER', 'JACKET', 'COAT']);                  // visible outer layer
const INNER_TOPS      = new Set(['TEE', 'SHIRT', 'KNIT', 'POLO']);              // worn underneath
const ACCESSORY_TYPES = new Set(['LOAFERS', 'SNEAKERS', 'BAG', 'WATCH', 'NECKLACE', 'SUNGLASSES', 'BELT', 'SCARF', 'RING', 'BRACELET', 'HAT']);

// Aspect ratios per type (width / height as a number) — keep proportions natural.
const ASPECT = {
  JEANS: 0.62, TROUSERS: 0.62, CHINOS: 0.62, SKIRT: 0.7,
  DRESS: 0.5, OVERCOAT: 0.58, COAT: 0.62,
  TEE: 0.82, SHIRT: 0.82, KNIT: 0.85, POLO: 0.82, BLAZER: 0.82, JACKET: 0.85,
  LOAFERS: 1.25, SNEAKERS: 1.25,
  BAG: 0.9, WATCH: 1, NECKLACE: 0.8, SUNGLASSES: 1.6, BELT: 1.4, SCARF: 1.2,
  RING: 1, BRACELET: 1.4, HAT: 1.1,
};

function resolveItemRoles(items) {
  let anchor = null;
  for (const t of ANCHOR_PRIORITY) {
    anchor = items.find(i => i.type === t);
    if (anchor) break;
  }
  if (!anchor) {
    anchor = items.find(i => !ACCESSORY_TYPES.has(i.type)) || items[0];
  }
  const accessories = items.filter(i => ACCESSORY_TYPES.has(i.type));
  // Secondaries: outer layer first (jacket / blazer), then inner (tee / knit / shirt)
  const rest = items.filter(i => i !== anchor && !ACCESSORY_TYPES.has(i.type));
  const outers = rest.filter(i => OUTER_TOPS.has(i.type));
  const inners = rest.filter(i => INNER_TOPS.has(i.type));
  const others = rest.filter(i => !OUTER_TOPS.has(i.type) && !INNER_TOPS.has(i.type));
  const secondaries = [...outers, ...inners, ...others];
  return { anchor, secondaries, accessories };
}

// ─── Layout zones (percentages of the collage canvas) ───
// Matches the user's annotated structure:
//   anchor  | secondary 1
//           | secondary 2
//   acc 1   | acc 2
//
// Secondaries sit close to the anchor, not pushed to the far edge.
// Accessories are noticeably smaller than secondaries.
const ZONES = {
  anchor:    { cx: 28, cy: 46, maxW: 38, maxH: 64 },
  sec1:      { cx: 68, cy: 26, maxW: 34, maxH: 26 },
  sec2:      { cx: 68, cy: 56, maxW: 34, maxH: 30 },
  acc1:      { cx: 26, cy: 86, maxW: 18, maxH: 14 },
  acc2:      { cx: 70, cy: 86, maxW: 22, maxH: 14 },
};

// Given a zone (max width/height %) and an aspect ratio, compute the
// largest box that fits inside. Returns {w, h} in % units.
function fitToZone(zone, aspect) {
  // Try filling max width first.
  let w = zone.maxW;
  let h = w / aspect;
  if (h > zone.maxH) { h = zone.maxH; w = h * aspect; }
  return { w, h };
}

// Convert zone + aspect into an absolute slot {x, y, w}
// (x/y are the top-left in %, with cx/cy as the zone center).
function placeInZone(zone, aspect, rot, z) {
  const { w, h } = fitToZone(zone, aspect);
  return {
    x: zone.cx - w / 2,
    y: zone.cy - h / 2,
    w,
    rot,
    z,
  };
}

// ─── Layout: anchor + 0-2 secondaries + 0-2 accessories ───
// Only items with PNG cutouts are positioned.
function layoutItems(allItems) {
  const items = allItems.filter(i => i.png);
  const { anchor, secondaries, accessories } = resolveItemRoles(items);
  const positioned = [];

  if (anchor) {
    positioned.push({ ...anchor, slot: placeInZone(ZONES.anchor, ASPECT[anchor.type] || 0.7, 0, 1) });
  }

  // Up to 2 secondaries
  if (secondaries[0]) {
    positioned.push({ ...secondaries[0], slot: placeInZone(ZONES.sec1, ASPECT[secondaries[0].type] || 0.85, 0, 3) });
  }
  if (secondaries[1]) {
    positioned.push({ ...secondaries[1], slot: placeInZone(ZONES.sec2, ASPECT[secondaries[1].type] || 0.85, 0, 4) });
  }

  // Up to 2 accessories
  if (accessories[0]) {
    positioned.push({ ...accessories[0], slot: placeInZone(ZONES.acc1, ASPECT[accessories[0].type] || 1, 0, 5) });
  }
  if (accessories[1]) {
    positioned.push({ ...accessories[1], slot: placeInZone(ZONES.acc2, ASPECT[accessories[1].type] || 1, 0, 6) });
  }

  return positioned;
}

// ─── Color name → hex for placeholder silhouettes ───
const COLOR_HEX = {
  Beige: '#D4C2A0', Cream: '#EFE6D2', White: '#F5F1E8', Tan: '#C9A77A',
  Brown: '#7C5A3B', Camel: '#B89776', Sand: '#D9C9A8', Stone: '#C2B7A3',
  Charcoal: '#3A3631', Black: '#1F1D1A', Grey: '#9C968B', Indigo: '#3E4A66',
  Blue: '#5C7392', Navy: '#2A3550', Gold: '#C9A865',
  Mustard: '#C6A24C', Olive: '#7B7A4E', Burgundy: '#7E2F36',
};

// ─── A single floating item on the collage ───
// Only items with a transparent PNG cutout are rendered. Items without a PNG
// are skipped — accessories without product cutouts live in the items list
// strip below the collage, not on the cream canvas.
function CollageItem({ item, slot, onClick }) {
  const [errored, setErrored] = React.useState(false);
  if (!item.png || errored) return null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.w}%`,
        transform: `rotate(${slot.rot}deg)`,
        transformOrigin: 'center',
        zIndex: slot.z || 1,
        cursor: onClick ? 'pointer' : 'default',
        filter: 'drop-shadow(0 8px 14px rgba(26, 24, 21, 0.08)) drop-shadow(0 1px 3px rgba(26, 24, 21, 0.05))',
        transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
      <img
        src={item.png}
        alt={item.name}
        onError={() => setErrored(true)}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          mixBlendMode: item.pngBlend ? 'multiply' : 'normal',
        }}
      />
    </div>
  );
}

// ─── Garment silhouette (placeholder when no PNG cutout is provided) ───
function GarmentSilhouette({ type, bg, fg, aspect, name, minimal = false }) {
  const radius = ({
    JEANS: 4, TROUSERS: 4, CHINOS: 4,
    SHIRT: 6, TEE: 8, KNIT: 16, BLAZER: 6, COAT: 6,
    BAG: 8, WATCH: 999, NECKLACE: 30, SUNGLASSES: 14, BELT: 4, SCARF: 6,
    LOAFERS: 10, SNEAKERS: 8,
  })[type] || 6;
  // Accessories: just show the type label, no name (too cramped on small tiles)
  const isAccessory = ['LOAFERS', 'SNEAKERS', 'BAG', 'WATCH', 'NECKLACE', 'SUNGLASSES', 'BELT', 'SCARF'].includes(type);
  const showName = !minimal && !isAccessory;

  return (
    <div style={{
      width: '100%', aspectRatio: aspect,
      background: bg,
      borderRadius: radius,
      border: `0.5px solid ${T.color.hairline}`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '10px 8px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ ...type.micro, fontSize: 8, color: fg, opacity: 0.8, textAlign: 'center' }}>
        {type}
      </div>
      {showName && (
        <>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: T.font.serif,
            fontSize: 10, fontWeight: 400,
            color: fg, opacity: 0.85,
            textAlign: 'center',
            lineHeight: 1.1,
          }}>{name}</div>
        </>
      )}
    </div>
  );
}

// ─── The collage itself ───
function OutfitCollage({ outfit, showTitle = true, height = '100%', bg = T.color.canvas, compact = false, titleTop = null }) {
  const items = outfit.itemIds.map(itemById).filter(Boolean);
  const positioned = layoutItems(items);
  const titleY = titleTop != null ? titleTop : (compact ? 16 : 24);

  return (
    <div style={{
      position: 'relative',
      width: '100%', height,
      background: bg,
      overflow: 'hidden',
    }}>
      {/* Title block — editorial header */}
      {showTitle && (
        <div style={{
          position: 'absolute', top: titleY, left: 0, right: 0,
          textAlign: 'center', padding: '0 24px', zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: T.font.serif,
            fontSize: compact ? 20 : 24,
            fontWeight: 400,
            letterSpacing: '0.06em',
            color: T.color.primary,
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}>{outfit.title}</div>
          <div style={{
            fontFamily: T.font.serif,
            fontSize: compact ? 12 : 14,
            fontWeight: 400,
            fontStyle: 'italic',
            color: T.color.secondary,
            marginTop: 8,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}>{outfit.subtitle || outfit.context.toLowerCase()}</div>
        </div>
      )}

      {/* Items area — leaves room for title at top */}
      <div style={{
        position: 'absolute',
        top: showTitle ? (titleY + (compact ? 52 : 72)) : 0,
        left: 0, right: 0, bottom: 8,
      }}>
        {positioned.map((item) => (
          <CollageItem key={item.id} item={item} slot={item.slot} />
        ))}
      </div>
    </div>
  );
}

// ─── AI Try-On Sheet ───
// Shows a "rendering" state, then a placeholder result of the user
// wearing the outfit, sized to their measurements.
function AITryOnSheet({ open, onClose, outfit, userMeasurements }) {
  const [phase, setPhase] = React.useState('intro'); // intro → rendering → result
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!open) { setTimeout(() => { setPhase('intro'); setProgress(0); }, 500); }
  }, [open]);

  React.useEffect(() => {
    if (phase !== 'rendering') return;
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(id); setPhase('result'); return 100; }
        return p + 4;
      });
    }, 80);
    return () => clearInterval(id);
  }, [phase]);

  const startRender = () => { setPhase('rendering'); setProgress(0); };

  if (!outfit) return null;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="92%">
      <div style={{ overflow: 'auto', flex: 1 }}>
        {phase === 'intro' && <TryOnIntro outfit={outfit} onStart={startRender} measurements={userMeasurements} />}
        {phase === 'rendering' && <TryOnRendering outfit={outfit} progress={progress} />}
        {phase === 'result' && <TryOnResult outfit={outfit} onRedo={() => setPhase('intro')} onClose={onClose} />}
      </div>
    </BottomSheet>
  );
}

function TryOnIntro({ outfit, onStart, measurements = { height: '178 cm', weight: '70 kg', size: 'M' } }) {
  return (
    <div style={{ padding: '24px 24px 32px' }}>
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>AI TRY-ON</div>
      <div style={{ height: 8 }} />
      <div style={{ ...type.h2, color: T.color.primary }}>See it on you.</div>
      <div style={{ ...type.caption, marginTop: 12 }}>
        We'll render {outfit.title} on your frame using your measurements and each item's size.
      </div>
      <div style={{ height: 32 }} />

      <div style={{ border: `0.5px solid ${T.color.hairline}`, padding: 20 }}>
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>YOUR FRAME</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'HEIGHT', value: measurements.height },
            { label: 'WEIGHT', value: measurements.weight },
            { label: 'SIZE',   value: measurements.size },
          ].map(s => (
            <div key={s.label}>
              <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{s.label}</div>
              <div style={{ fontFamily: T.font.serif, fontSize: 18, fontWeight: 400, color: T.color.primary, marginTop: 4 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div style={{ border: `0.5px solid ${T.color.hairline}`, padding: 20 }}>
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>
          OUTFIT ({outfit.itemIds.length} ITEMS)
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {outfit.itemIds.map((id) => {
            const it = itemById(id);
            if (!it) return null;
            return (
              <div key={id} style={{
                flexShrink: 0, width: 48, height: 60,
                border: `0.5px solid ${T.color.hairline}`,
                overflow: 'hidden',
              }}>
                <Photo src={it.img} label={it.type} tone={it.tone} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 32 }} />
      <PrimaryButton onClick={onStart}>GENERATE</PrimaryButton>
      <div style={{ height: 12 }} />
      <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, textAlign: 'center' }}>
        Takes ~6 seconds. Result stays private to your device.
      </div>
    </div>
  );
}

function TryOnRendering({ outfit, progress }) {
  return (
    <div style={{ padding: '24px 24px 32px' }}>
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>RENDERING</div>
      <div style={{ height: 8 }} />
      <div style={{ ...type.h2, color: T.color.primary }}>Composing your fit…</div>
      <div style={{ height: 32 }} />

      <div style={{
        width: '100%', aspectRatio: '3/4',
        background: T.color.elevated,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* shimmering placeholder body silhouette */}
        <svg viewBox="0 0 300 400" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="shimmer" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#D9D2C5" />
              <stop offset="50%" stopColor="#E8E0D0" />
              <stop offset="100%" stopColor="#D9D2C5" />
              <animate attributeName="x1" from="-1" to="1" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="x2" from="0" to="2" dur="1.8s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <path
            d="M150 40 Q170 40 175 65 Q180 90 165 100 Q200 110 210 160 L215 240 Q215 280 200 320 L195 380 L165 380 L160 320 L140 320 L135 380 L105 380 L100 320 Q85 280 85 240 L90 160 Q100 110 135 100 Q120 90 125 65 Q130 40 150 40 Z"
            fill="url(#shimmer)"
            opacity="0.7"
          />
        </svg>
      </div>

      <div style={{ height: 24 }} />
      <div style={{ position: 'relative', height: 1, background: T.color.hairline }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progress}%`,
          background: T.color.primary,
          transition: 'width 80ms linear',
        }} />
      </div>
      <div style={{ height: 12 }} />
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, textAlign: 'center' }}>
        {progress < 30 && 'ANALYZING YOUR FRAME'}
        {progress >= 30 && progress < 60 && 'FITTING GARMENTS'}
        {progress >= 60 && progress < 90 && 'ADJUSTING DRAPE'}
        {progress >= 90 && 'FINISHING'}
        {' · ' + progress + '%'}
      </div>
    </div>
  );
}

function TryOnResult({ outfit, onRedo, onClose }) {
  return (
    <div style={{ padding: '24px 24px 32px' }}>
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>RESULT</div>
      <div style={{ height: 8 }} />
      <div style={{ ...type.h2, color: T.color.primary }}>{outfit.title} on you.</div>
      <div style={{ height: 24 }} />

      <div style={{
        width: '100%', aspectRatio: '3/4',
        overflow: 'hidden', position: 'relative',
        border: `0.5px solid ${T.color.hairline}`,
      }}>
        <Photo src={outfit.img} label="GENERATED" tone={outfit.tone}
          style={{ filter: 'saturate(0.85) contrast(0.98)' }} />
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: T.color.canvas, padding: '4px 8px',
          ...type.ui, fontSize: 9, color: T.color.primary,
        }}>AI · {new Date().getFullYear()}</div>
      </div>

      <div style={{ height: 16 }} />
      <div style={{ display: 'flex', gap: 12, ...type.caption, fontSize: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>FIT</div>
          <div style={{ marginTop: 4, color: T.color.primary }}>True to size</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>DRAPE</div>
          <div style={{ marginTop: 4, color: T.color.primary }}>Relaxed</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>CONFIDENCE</div>
          <div style={{ marginTop: 4, color: T.color.primary }}>94%</div>
        </div>
      </div>

      <div style={{ height: 32 }} />
      <PrimaryButton onClick={onClose}>WEAR TODAY</PrimaryButton>
      <div style={{ height: 12 }} />
      <SecondaryButton onClick={onRedo}>GENERATE AGAIN</SecondaryButton>
      <div style={{ height: 16 }} />
      <div style={{ textAlign: 'center' }}>
        <TextLink color={T.color.tertiary}>Save image to library</TextLink>
      </div>
    </div>
  );
}

Object.assign(window, { OutfitCollage, CollageItem, AITryOnSheet, layoutItems, COLOR_HEX });
