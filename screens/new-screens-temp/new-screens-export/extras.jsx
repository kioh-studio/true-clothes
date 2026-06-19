// extras.jsx — Missing screens for TRUE CLOTHES
//   SavedOutfitsScreen        Saved (bookmarked) outfits — grid view
//   OutfitBuilderScreen       Manual outfit builder
//   WardrobeIntroScreen       Final onboarding step — add first item or skip
//   MenuScreen                Full-screen Menu (replaces / supplements MenuSheet)
//   StylesEditScreen          Post-onboarding edit of style picks
//   ColorsEditScreen          Post-onboarding edit of color palette
//   MeasurementsEditScreen    Post-onboarding edit of measurements

// ─── shared header used by these screens ───
function ScreenHeader({ title, onBack, onClose, rightLabel, onRight, rightIcon }) {
  const btn = {
    width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary,
  };
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', flexShrink: 0,
    }}>
      {onBack && <button onClick={onBack} style={btn}><IconChevronLeft size={20} strokeWidth={1.4} /></button>}
      {onClose && <button onClick={onClose} style={btn}><IconX size={20} strokeWidth={1.4} /></button>}
      {!onBack && !onClose && <div style={{ width: 44 }} />}
      <div style={{ ...type.h3, color: T.color.primary }}>{title}</div>
      {rightLabel ? (
        <button onClick={onRight} style={{
          ...type.ui, fontSize: 11, height: 44, padding: '0 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.color.primary,
        }}>{rightLabel}</button>
      ) : rightIcon ? (
        <button onClick={onRight} style={btn}>{rightIcon}</button>
      ) : <div style={{ width: 44 }} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SAVED OUTFITS
// ═════════════════════════════════════════════════════════════
function SavedOutfitsScreen({ onBack, outfits, savedSet, onOpenOutfit, onToggleSave }) {
  const saved = outfits.filter(o => savedSet.has(o.id));
  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Saved" onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {saved.length === 0 ? (
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto',
              border: `0.5px solid ${T.color.hairlineStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.color.primary,
            }}>
              <IconBookmark size={22} strokeWidth={1.2} />
            </div>
            <div style={{ height: 24 }} />
            <div style={{ ...type.h2, color: T.color.primary }}>Nothing saved yet.</div>
            <div style={{ ...type.caption, marginTop: 12, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>
              Tap the bookmark on any outfit in your feed to keep it for later.
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '8px 24px 24px' }}>
              <div style={{ ...type.h1, color: T.color.primary }}>Saved</div>
              <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 12 }}>
                {saved.length} OUTFIT{saved.length === 1 ? '' : 'S'}
              </div>
            </div>
            <div style={{ padding: '0 24px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {saved.map(o => (
                  <div key={o.id} onClick={() => onOpenOutfit(o.id)}
                    style={{ cursor: 'pointer', position: 'relative', aspectRatio: '3/4', overflow: 'hidden', border: `0.5px solid ${T.color.hairline}` }}>
                    <Photo src={o.img} label={o.title} tone={o.tone} />
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', background: 'linear-gradient(to top, rgba(26,24,21,0.7), transparent)' }} />
                    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                      <div style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.85)' }}>{o.style}</div>
                      <div style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.canvas, marginTop: 4 }}>{o.title}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onToggleSave(o.id); }}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 32, height: 32, borderRadius: 999,
                        background: 'rgba(250,247,242,0.92)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.color.primary,
                      }}>
                      <IconBookmark size={14} strokeWidth={1.4} filled />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// BUILD AN OUTFIT
// ═════════════════════════════════════════════════════════════
const BUILDER_BUCKETS = [
  { key: 'TOPS',     types: ['TEE', 'KNIT', 'POLO', 'SHIRT'] },
  { key: 'BOTTOMS',  types: ['JEANS', 'TROUSERS', 'CHINOS'] },
  { key: 'OUTERWEAR',types: ['JACKET', 'BLAZER', 'COAT'] },
  { key: 'SHOES',    types: ['LOAFERS', 'SNEAKERS'] },
  { key: 'BAGS',     types: ['BAG'] },
];

function OutfitBuilderScreen({ onBack, items, onSaveOutfit }) {
  const buckets = BUILDER_BUCKETS.map(b => ({
    ...b,
    list: items.filter(i => b.types.includes(i.type)),
  }));

  // Start with a sensible default — first available in core categories.
  const findFirst = (types) => items.find(i => types.includes(i.type) && i.png)?.id || null;
  const [sel, setSel] = React.useState({
    TOPS: findFirst(['TEE', 'KNIT', 'POLO']),
    BOTTOMS: findFirst(['JEANS', 'TROUSERS', 'CHINOS']),
    OUTERWEAR: null,
    SHOES: findFirst(['LOAFERS', 'SNEAKERS']),
    BAGS: null,
  });
  const pick = (cat, id) => setSel(s => ({ ...s, [cat]: s[cat] === id ? null : id }));

  const selectedIds = Object.values(sel).filter(Boolean);
  const tempOutfit = {
    title: 'New outfit', subtitle: 'in progress', style: 'CUSTOM', context: 'NEW', tone: 0,
    itemIds: selectedIds,
  };

  const shuffle = () => {
    const r = (arr) => arr[Math.floor(Math.random() * arr.length)]?.id || null;
    setSel({
      TOPS: r(buckets[0].list),
      BOTTOMS: r(buckets[1].list),
      OUTERWEAR: Math.random() > 0.55 ? r(buckets[2].list) : null,
      SHOES: r(buckets[3].list),
      BAGS: Math.random() > 0.55 ? r(buckets[4].list) : null,
    });
  };
  const clear = () => setSel({ TOPS: null, BOTTOMS: null, OUTERWEAR: null, SHOES: null, BAGS: null });

  const [nameOpen, setNameOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [suggestOpen, setSuggestOpen] = React.useState(false);

  const canSave = selectedIds.length >= 2;

  // Apply a generated suggestion to the canvas. Sets the picker selections to
  // match the suggested itemIds (mapped back into their categories).
  const applySuggestion = (suggestion) => {
    const next = { TOPS: null, BOTTOMS: null, OUTERWEAR: null, SHOES: null, BAGS: null };
    for (const id of suggestion.itemIds) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      const bucket = BUILDER_BUCKETS.find(b => b.types.includes(item.type));
      if (bucket && !next[bucket.key]) next[bucket.key] = id;
    }
    setSel(next);
    setSuggestOpen(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Build" onBack={onBack} rightIcon={<IconShuffle size={20} strokeWidth={1.4} />} onRight={shuffle} />

      {/* Canvas */}
      <div style={{
        flex: '0 0 38%', position: 'relative',
        borderBottom: `0.5px solid ${T.color.hairline}`,
        background: T.color.canvas,
      }}>
        {selectedIds.length === 0 ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{
              width: 48, height: 48, border: `0.5px dashed ${T.color.hairlineStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.color.tertiary,
            }}>
              <IconPlus size={18} strokeWidth={1.4} />
            </div>
            <div style={{ ...type.micro, color: T.color.tertiary }}>EMPTY CANVAS</div>
            <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary }}>Pick items below to compose an outfit</div>
          </div>
        ) : (
          <OutfitCollage outfit={tempOutfit} showTitle={false} />
        )}
        {selectedIds.length > 0 && (
          <button onClick={clear} style={{
            position: 'absolute', top: 12, right: 16,
            ...type.ui, fontSize: 9, color: T.color.tertiary,
            background: 'transparent', border: 'none', cursor: 'pointer',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>CLEAR ALL</button>
        )}
        {selectedIds.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 16,
            ...type.ui, fontSize: 9, color: T.color.tertiary,
          }}>{selectedIds.length} PIECE{selectedIds.length === 1 ? '' : 'S'}</div>
        )}
      </div>

      {/* Pickers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0 8px' }}>
        {buckets.map(b => b.list.length > 0 && (
          <CategoryStrip key={b.key}
            label={b.key}
            items={b.list}
            selectedId={sel[b.key]}
            onSelect={(id) => pick(b.key, id)} />
        ))}
      </div>

      {/* Suggest CTA — secondary action above SAVE */}
      <div style={{ padding: '8px 24px 0', flexShrink: 0, background: T.color.canvas }}>
        <button onClick={() => setSuggestOpen(true)} style={{
          width: '100%', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'transparent',
          border: `0.5px solid ${T.color.hairlineStrong}`,
          color: T.color.primary,
          cursor: 'pointer', borderRadius: 0,
          ...type.ui, fontSize: 10,
        }}>
          <IconSparkle size={14} strokeWidth={1.4} />
          <span>
            {selectedIds.length === 0
              ? 'SUGGEST OUTFITS FOR ME'
              : `SUGGEST OUTFITS WITH ${selectedIds.length} ANCHOR${selectedIds.length === 1 ? '' : 'S'}`}
          </span>
        </button>
      </div>

      {/* SAVE */}
      <div style={{ padding: '12px 24px 20px', flexShrink: 0, background: T.color.canvas }}>
        <PrimaryButton onClick={() => canSave && setNameOpen(true)} disabled={!canSave}>
          {!canSave ? 'PICK AT LEAST 2 PIECES' : 'SAVE OUTFIT'}
        </PrimaryButton>
      </div>

      {/* Name sheet */}
      <BottomSheet open={nameOpen} onClose={() => setNameOpen(false)} maxHeight="58%">
        <div style={{ padding: '24px 24px 32px' }}>
          <div style={{ ...type.h2, color: T.color.primary }}>Name your outfit.</div>
          <div style={{ ...type.caption, marginTop: 8 }}>A short title you'll recognize in your collections.</div>
          <div style={{ height: 32 }} />
          <Field label="OUTFIT NAME" value={name} onChange={setName} placeholder="Monday rotation" autoFocus />
          <div style={{ height: 16 }} />
          <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary }}>
            {selectedIds.length} piece{selectedIds.length === 1 ? '' : 's'} · {Object.entries(sel).filter(([_, v]) => v).map(([k]) => k.toLowerCase()).join(' · ')}
          </div>
          <div style={{ height: 32 }} />
          <PrimaryButton onClick={() => {
            onSaveOutfit({ name: name.trim() || 'New outfit', itemIds: selectedIds });
            setNameOpen(false);
            setName('');
          }}>SAVE TO COLLECTION</PrimaryButton>
          <div style={{ height: 12 }} />
          <div style={{ textAlign: 'center' }}>
            <TextLink onClick={() => setNameOpen(false)} color={T.color.tertiary}>Keep editing</TextLink>
          </div>
        </div>
      </BottomSheet>

      {/* Suggest sheet */}
      <SuggestSheet
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        items={items}
        anchorIds={selectedIds}
        onApply={applySuggestion}
      />
    </div>
  );
}

function CategoryStrip({ label, items, selectedId, onSelect }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '0 24px', marginBottom: 12,
      }}>
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>{label}</div>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, opacity: 0.6 }}>{items.length} AVAILABLE</div>
      </div>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto',
        padding: '0 24px 4px', scrollbarWidth: 'none',
      }}>
        {items.map(item => (
          <BuilderTile key={item.id} item={item} selected={selectedId === item.id} onClick={() => onSelect(item.id)} />
        ))}
      </div>
    </div>
  );
}

function BuilderTile({ item, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 84, height: 104,
      background: T.color.elevated,
      border: selected ? `1px solid ${T.color.primary}` : `0.5px solid ${T.color.hairline}`,
      borderRadius: 0,
      padding: 8,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      transition: 'border 200ms',
    }}>
      {item.png ? (
        <img src={item.png} alt={item.name}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: item.pngBlend ? 'multiply' : 'normal' }} />
      ) : (
        <span style={{ ...type.micro, fontSize: 9, color: T.color.tertiary, textAlign: 'center', lineHeight: 1.2 }}>{item.type}</span>
      )}
      {selected && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 16, height: 16, borderRadius: 999,
          background: T.color.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCheck size={10} color={T.color.canvas} strokeWidth={2} />
        </div>
      )}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════
// WARDROBE INTRO  (final onboarding step)
// ═════════════════════════════════════════════════════════════
function WardrobeIntroScreen({ onAddItem, onSkip }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column',
      opacity: show ? 1 : 0, transition: 'opacity 500ms ease-out',
    }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      {/* hanger illustration block */}
      <div style={{
        flex: '0 0 46%', position: 'relative',
        padding: '32px 24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: T.color.elevated,
          border: `0.5px solid ${T.color.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* faint hangers */}
          <svg width="240" height="180" viewBox="0 0 240 180" fill="none" stroke={T.color.tertiary} strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round">
            {[0, 1, 2].map(i => (
              <g key={i} transform={`translate(${40 + i * 80} 30)`}>
                <path d="M40 18a3 3 0 11.5-5.9c2 .5 2.5 2 2.5 4v3L18 36h44L48 18.5" />
                <circle cx="40" cy="12" r="0.8" fill={T.color.tertiary} fillOpacity="0.35" />
                {/* hanging garment shadow */}
                <rect x="22" y="42" width="36" height="80" fill={T.color.hairline} stroke="none" opacity="0.5" />
              </g>
            ))}
          </svg>
          <div style={{ position: 'absolute', bottom: 16, right: 16, ...type.micro, color: T.color.tertiary }}>
            YOUR CLOSET · EMPTY
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px 32px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...type.h1, color: T.color.primary }}>Your wardrobe.</div>
        <div style={{ ...type.bodyL, color: T.color.secondary, marginTop: 16 }}>
          Add what you already own. We'll build outfits from real pieces — not generic suggestions.
        </div>

        <div style={{ height: 24 }} />
        <div style={{ display: 'flex', gap: 24, padding: '16px 0' }}>
          {[
            { n: '01', label: 'SNAP A PHOTO' },
            { n: '02', label: 'WE EXTRACT DETAILS' },
            { n: '03', label: 'OUTFITS APPEAR' },
          ].map(s => (
            <div key={s.n} style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font.serif, fontSize: 22, fontWeight: 300, color: T.color.primary, lineHeight: 1 }}>{s.n}</div>
              <div style={{ height: 8 }} />
              <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />
        <PrimaryButton onClick={onAddItem}>ADD FIRST ITEM</PrimaryButton>
        <div style={{ height: 16 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onSkip} color={T.color.tertiary} arrow>Skip for now</TextLink>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MENU SCREEN (full-screen version of the bottom-sheet menu)
// ═════════════════════════════════════════════════════════════
function MenuScreen({ onBack, onNavigate, onSignOut }) {
  const sections = [
    {
      label: 'CREATE',
      items: [
        { icon: <IconDashedSquare size={20} strokeWidth={1.4} />, title: 'Build an outfit', desc: 'Compose from your wardrobe', go: 'BUILDER' },
        { icon: <IconBookmark size={20} strokeWidth={1.4} />, title: 'Saved outfits', desc: 'Bookmarks from your feed', go: 'SAVED' },
        { icon: <IconLayers size={20} strokeWidth={1.4} />, title: 'Collections', desc: 'Outfits grouped by theme', go: 'COLLECTIONS' },
        { icon: <IconCalendar size={20} strokeWidth={1.4} />, title: 'Schedule outfits', desc: 'Plan the week ahead', go: 'SCHEDULE' },
      ],
    },
    {
      label: 'DISCOVER',
      items: [
        { icon: <IconPin size={20} strokeWidth={1.4} />, title: 'Trending in your area', desc: 'What people are wearing nearby', soon: true },
        { icon: <IconBook size={20} strokeWidth={1.4} />, title: 'Style guide', desc: 'Notes on rules worth keeping', soon: true },
      ],
    },
    {
      label: 'YOU',
      items: [
        { icon: <IconUser size={20} strokeWidth={1.4} />, title: 'Profile', desc: 'Your account and stats', go: 'PROFILE' },
        { icon: <IconSparkle size={20} strokeWidth={1.4} />, title: 'Style preferences', desc: 'Edit your style picks', go: 'STYLES_EDIT' },
        { icon: <IconDot size={20} strokeWidth={1.4} />, title: 'Color palette', desc: 'Edit your color choices', go: 'COLORS_EDIT' },
        { icon: <IconEdit size={20} strokeWidth={1.4} />, title: 'Size & measurements', desc: 'Edit your sizing', go: 'MEASUREMENTS_EDIT' },
      ],
    },
    {
      label: 'SUPPORT',
      items: [
        { icon: <IconSettings size={20} strokeWidth={1.4} />, title: 'Settings', desc: 'Notifications, units, account', soon: true },
        { icon: <IconChat size={20} strokeWidth={1.4} />, title: 'Help & feedback', desc: 'Reach the team', soon: true },
      ],
    },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="" onClose={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 40px' }}>
        <div style={{ padding: '8px 0 32px' }}>
          <div style={{ ...type.h1, color: T.color.primary }}>Menu</div>
          <div style={{ ...type.caption, marginTop: 12 }}>Everything that doesn't live on the home feed.</div>
        </div>

        {sections.map((sec, si) => (
          <div key={sec.label} style={{ marginBottom: 32 }}>
            <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>{sec.label}</div>
            <div style={{ borderTop: `0.5px solid ${T.color.hairline}` }}>
              {sec.items.map((it, i) => (
                <div key={i}
                  onClick={() => it.go ? onNavigate(it.go) : null}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 0',
                    borderBottom: `0.5px solid ${T.color.hairline}`,
                    cursor: it.go ? 'pointer' : 'default',
                    opacity: it.soon ? 0.55 : 1,
                  }}>
                  <div style={{ color: T.color.primary, width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 400, color: T.color.primary }}>{it.title}</div>
                    <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 2 }}>{it.desc}</div>
                  </div>
                  {it.soon ? (
                    <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>SOON</div>
                  ) : (
                    <IconChevronRight size={12} strokeWidth={1.4} color={T.color.tertiary} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ height: 8 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onSignOut} color={T.color.tertiary}>Sign out</TextLink>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ ...type.micro, color: T.color.tertiary, textAlign: 'center', opacity: 0.6 }}>TRUE CLOTHES · v1.0.0</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SHARED — sticky save bar at bottom of edit screens
// ═════════════════════════════════════════════════════════════
function StickyEditBar({ dirty, onSave, onDiscard, saveLabel = 'SAVE CHANGES' }) {
  return (
    <div style={{
      padding: '12px 24px 20px',
      borderTop: `0.5px solid ${T.color.hairline}`,
      background: T.color.canvas,
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {dirty && (
        <button onClick={onDiscard} style={{
          ...type.ui, fontSize: 10, height: 56, padding: '0 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.color.tertiary,
        }}>DISCARD</button>
      )}
      <div style={{ flex: 1 }}>
        <PrimaryButton onClick={dirty ? onSave : undefined} disabled={!dirty}>
          {dirty ? saveLabel : 'NO CHANGES'}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// STYLES EDIT  (top-level aesthetics + niche refinement)
// ═════════════════════════════════════════════════════════════
function StylesEditScreen({ onBack, initial = ['minimalist', 'smartcasual'], initialNiches = [], onSave }) {
  const [selected, setSelected] = React.useState(initial);
  const [niches, setNiches] = React.useState(initialNiches);

  const initialKey = JSON.stringify([[...initial].sort(), [...initialNiches].sort()]);
  const currentKey = JSON.stringify([[...selected].sort(), [...niches].sort()]);
  const dirty = initialKey !== currentKey;

  const toggle = (id) => setSelected(s => {
    if (s.includes(id)) {
      // Removing a parent prunes its niches too.
      const childIds = (STYLE_NICHES[id] || []).map(n => n.id);
      setNiches(ns => ns.filter(n => !childIds.includes(n)));
      return s.filter(x => x !== id);
    }
    return [...s, id];
  });
  const toggleNiche = (id) => setNiches(ns => ns.includes(id) ? ns.filter(x => x !== id) : [...ns, id]);

  // Only show refinement section once at least one parent is picked.
  const refinable = selected.filter(id => (STYLE_NICHES[id] || []).length > 0);

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Style preferences" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 24px' }}>
        <div style={{ ...type.h1, color: T.color.primary }}>Your styles.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>
          Pick the aesthetics you lean into. We'll refine your feed within the hour.
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 28, marginBottom: 16,
        }}>
          <div style={{ ...type.ui, fontSize: 10, color: T.color.primary }}>01</div>
          <div style={{ ...type.ui, fontSize: 10, color: T.color.primary }}>AESTHETICS</div>
          <div style={{ flex: 1, height: 0.5, background: T.color.hairline }} />
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{selected.length} / {STYLES.length}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {STYLES.map(s => (
            <StyleCard key={s.id} style={s} selected={selected.includes(s.id)} onClick={() => toggle(s.id)} />
          ))}
        </div>

        {/* Refinement: niches per selected parent */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 40, marginBottom: 16,
        }}>
          <div style={{ ...type.ui, fontSize: 10, color: refinable.length ? T.color.primary : T.color.tertiary }}>02</div>
          <div style={{ ...type.ui, fontSize: 10, color: refinable.length ? T.color.primary : T.color.tertiary }}>REFINE</div>
          <div style={{ flex: 1, height: 0.5, background: T.color.hairline }} />
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{niches.length} PICKED</div>
        </div>

        {refinable.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
            border: `0.5px dashed ${T.color.hairline}`,
          }}>
            <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary }}>
              Pick an aesthetic above to see niche directions tuned to it.
            </div>
          </div>
        ) : (
          refinable.map(parentId => {
            const parent = STYLES.find(s => s.id === parentId);
            const list = STYLE_NICHES[parentId] || [];
            return (
              <div key={parentId} style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <div>
                    <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>BECAUSE YOU LIKE</div>
                    <div style={{ fontFamily: T.font.serif, fontSize: 22, fontWeight: 400, color: T.color.primary, marginTop: 4 }}>
                      {parent.name}
                    </div>
                  </div>
                  <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>
                    {niches.filter(n => n.startsWith(parentId + ':')).length} / {list.length}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {list.map(n => {
                    const isSelected = niches.includes(n.id);
                    return (
                      <button key={n.id} onClick={() => toggleNiche(n.id)} style={{
                        textAlign: 'left',
                        padding: '14px 14px',
                        background: isSelected ? T.color.primary : 'transparent',
                        color: isSelected ? T.color.canvas : T.color.primary,
                        border: isSelected ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
                        cursor: 'pointer', borderRadius: 0,
                        display: 'flex', flexDirection: 'column', gap: 6,
                        minHeight: 72,
                        transition: 'background 200ms, color 200ms',
                      }}>
                        <div style={{
                          fontFamily: T.font.serif, fontSize: 14, fontWeight: 400, lineHeight: 1.1,
                        }}>{n.name}</div>
                        <div style={{
                          ...type.ui, fontSize: 9,
                          color: isSelected ? 'rgba(250,247,242,0.65)' : T.color.tertiary,
                          textTransform: 'none', letterSpacing: '0.02em', fontWeight: 400,
                          fontFamily: T.font.sans,
                        }}>{n.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      <StickyEditBar
        dirty={dirty}
        onSave={() => { onSave({ styles: selected, niches }); onBack(); }}
        onDiscard={() => { setSelected(initial); setNiches(initialNiches); }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// COLORS EDIT
// ═════════════════════════════════════════════════════════════
function ColorsEditScreen({ onBack, initial = ['Cream', 'Charcoal', 'Black', 'Navy', 'Sage'], onSave }) {
  const [selected, setSelected] = React.useState(initial);
  const initialKey = JSON.stringify([...initial].sort());
  const currentKey = JSON.stringify([...selected].sort());
  const dirty = initialKey !== currentKey;

  const toggle = (name) => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);

  // group by tag
  const groups = COLORS.reduce((acc, c) => { (acc[c.tag] ||= []).push(c); return acc; }, {});

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Color palette" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 24px' }}>
        <div style={{ ...type.h1, color: T.color.primary }}>Your palette.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>The tones we'll lean into for your outfits.</div>

        {/* Selected palette strip */}
        <div style={{ height: 32 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>
          CURRENT PALETTE · {selected.length}
        </div>
        <div style={{
          display: 'flex', height: 56,
          border: `0.5px solid ${T.color.hairline}`,
          background: T.color.elevated,
        }}>
          {selected.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...type.micro, color: T.color.tertiary }}>
              EMPTY · PICK FROM BELOW
            </div>
          ) : (
            selected.map(name => {
              const c = COLORS.find(x => x.name === name);
              return c ? <div key={name} title={name} style={{ flex: 1, background: c.hex }} /> : null;
            })
          )}
        </div>

        {/* Grouped swatches */}
        {Object.entries(groups).map(([tag, list]) => (
          <div key={tag} style={{ marginTop: 32 }}>
            <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>{tag}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              {list.map(c => {
                const isLight = ['#F2EDE4', '#D9C9A8', '#C8C5BF'].includes(c.hex);
                const isSelected = selected.includes(c.name);
                return (
                  <div key={c.name} onClick={() => toggle(c.name)} style={{ cursor: 'pointer' }}>
                    <div style={{
                      position: 'relative',
                      aspectRatio: '1/1',
                      background: c.hex,
                      outline: isSelected ? `1px solid ${T.color.primary}` : 'none',
                      outlineOffset: -1,
                    }}>
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 10, height: 10, borderRadius: 999,
                          background: isLight ? T.color.primary : T.color.canvas,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontFamily: T.font.serif, fontSize: 12, fontWeight: 400,
                      color: T.color.primary, textAlign: 'center', marginTop: 6,
                    }}>{c.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <StickyEditBar
        dirty={dirty}
        onSave={() => { onSave(selected); onBack(); }}
        onDiscard={() => setSelected(initial)}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MEASUREMENTS EDIT
// ═════════════════════════════════════════════════════════════
function MeasurementsEditScreen({ onBack, initial, onSave }) {
  const seed = initial || {
    height: '178', heightUnit: 'CM',
    weight: '70',  weightUnit: 'KG',
    chest: '92', waist: '78', hips: '94', inseam: '78',
    fit: 'REGULAR',
  };
  const [v, setV] = React.useState(seed);
  const set = (k, val) => setV(p => ({ ...p, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(seed);

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Size & measurements" onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 24px' }}>
        <div style={{ ...type.h1, color: T.color.primary }}>Measurements.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>We use these for fit recommendations and the AI try-on.</div>

        <div style={{ height: 32 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 }}>BASICS</div>

        <div style={{ position: 'relative' }}>
          <Field label="HEIGHT" value={v.height} onChange={(val) => set('height', val)} placeholder="—" suffix={v.heightUnit.toLowerCase()} inputMode="numeric" />
          <div style={{ position: 'absolute', right: 0, top: 16 }}>
            <Segmented options={['CM', 'IN']} value={v.heightUnit} onChange={(u) => set('heightUnit', u)} />
          </div>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ position: 'relative' }}>
          <Field label="WEIGHT" value={v.weight} onChange={(val) => set('weight', val)} placeholder="—" suffix={v.weightUnit.toLowerCase()} inputMode="numeric" />
          <div style={{ position: 'absolute', right: 0, top: 16 }}>
            <Segmented options={['KG', 'LB']} value={v.weightUnit} onChange={(u) => set('weightUnit', u)} />
          </div>
        </div>

        <div style={{ height: 40 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 16 }}>
          BODY · IMPROVES ACCURACY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="CHEST / BUST" value={v.chest} onChange={(val) => set('chest', val)} placeholder="— cm" inputMode="numeric" />
          <Field label="WAIST" value={v.waist} onChange={(val) => set('waist', val)} placeholder="— cm" inputMode="numeric" />
          <Field label="HIPS" value={v.hips} onChange={(val) => set('hips', val)} placeholder="— cm" inputMode="numeric" />
          <Field label="INSEAM" value={v.inseam} onChange={(val) => set('inseam', val)} placeholder="— cm" inputMode="numeric" />
        </div>

        <div style={{ height: 40 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>PREFERRED FIT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED'].map(f => (
            <Tag key={f} selected={v.fit === f} onClick={() => set('fit', f)}>{f}</Tag>
          ))}
        </div>

        <div style={{ height: 32 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink color={T.color.primary} arrow>Re-estimate with AI photo capture</TextLink>
          <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 8 }}>
            Take a photo in fitted clothing — we'll re-estimate on device.
          </div>
        </div>
      </div>
      <StickyEditBar
        dirty={dirty}
        onSave={() => { onSave(v); onBack(); }}
        onDiscard={() => setV(seed)}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SUGGEST SHEET — generate outfits from anchor pieces + filters
// ═════════════════════════════════════════════════════════════
function SuggestSheet({ open, onClose, items, anchorIds, onApply }) {
  const [styleFilter, setStyleFilter] = React.useState(null);
  const [colorFilter, setColorFilter] = React.useState(null);
  const [occasionFilter, setOccasionFilter] = React.useState(null);
  const [phase, setPhase] = React.useState('configure'); // configure → generating → results
  const [results, setResults] = React.useState([]);
  const [dots, setDots] = React.useState(1);

  React.useEffect(() => {
    if (!open) {
      // reset shortly after close so the sheet animation isn't ugly
      const t = setTimeout(() => {
        setPhase('configure'); setResults([]);
        setStyleFilter(null); setColorFilter(null); setOccasionFilter(null);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    if (phase !== 'generating') return;
    const i = setInterval(() => setDots(d => (d + 1) % 4), 380);
    return () => clearInterval(i);
  }, [phase]);

  const generate = () => {
    setPhase('generating');
    setTimeout(() => {
      setResults(generateOutfits({ items, anchorIds, styleFilter, colorFilter, occasionFilter }));
      setPhase('results');
    }, 1500);
  };

  const anchors = anchorIds.map(id => items.find(i => i.id === id)).filter(Boolean);

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="92%">
      {phase === 'configure' && (
        <div style={{ overflow: 'auto', flex: 1, padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconSparkle size={18} strokeWidth={1.4} color={T.color.primary} />
            <div style={{ ...type.h2, color: T.color.primary }}>Suggest outfits.</div>
          </div>
          <div style={{ ...type.caption, marginTop: 8 }}>
            We'll compose outfits that work with what you've picked. Filters are optional.
          </div>

          {/* Anchor pieces */}
          <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 28, marginBottom: 12 }}>
            ANCHOR PIECES {anchors.length === 0 && '(NONE — WE\u2019LL START FROM SCRATCH)'}
          </div>
          {anchors.length === 0 ? (
            <div style={{
              padding: '20px 16px', textAlign: 'center',
              border: `0.5px dashed ${T.color.hairline}`,
              ...type.caption, fontSize: 12, color: T.color.tertiary,
            }}>
              Tip — pick a piece on the canvas first, and we'll build around it.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {anchors.map(item => (
                <div key={item.id} style={{
                  flexShrink: 0, width: 76, height: 92,
                  background: T.color.elevated,
                  border: `0.5px solid ${T.color.hairline}`,
                  padding: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {item.png ? (
                    <img src={item.png} alt={item.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: item.pngBlend ? 'multiply' : 'normal' }} />
                  ) : (
                    <span style={{ ...type.micro, fontSize: 8, color: T.color.tertiary }}>{item.type}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <FilterRow label="STYLE" hint="OPTIONAL">
            {[null, ...STYLES.slice(0, 6).map(s => s.id)].map(id => (
              <Tag key={id || 'any'} selected={styleFilter === id}
                onClick={() => setStyleFilter(styleFilter === id ? null : id)} size="sm">
                {id ? STYLES.find(s => s.id === id).name.toUpperCase() : 'ANY'}
              </Tag>
            ))}
          </FilterRow>

          <FilterRow label="COLOR LEAN" hint="OPTIONAL">
            {[null, 'WARM', 'EARTH', 'NEUTRAL', 'DARK NEUTRAL', 'COOL'].map(t => (
              <Tag key={t || 'any'} selected={colorFilter === t}
                onClick={() => setColorFilter(colorFilter === t ? null : t)} size="sm">
                {t ? t : 'ANY'}
              </Tag>
            ))}
          </FilterRow>

          <FilterRow label="OCCASION" hint="OPTIONAL">
            {[null, ...OCCASIONS].map(o => (
              <Tag key={o || 'any'} selected={occasionFilter === o}
                onClick={() => setOccasionFilter(occasionFilter === o ? null : o)} size="sm">
                {o || 'ANY'}
              </Tag>
            ))}
          </FilterRow>

          <div style={{ height: 32 }} />
          <PrimaryButton onClick={generate}>GENERATE OUTFITS</PrimaryButton>
          <div style={{ height: 12 }} />
          <div style={{ textAlign: 'center' }}>
            <TextLink onClick={onClose} color={T.color.tertiary}>Cancel</TextLink>
          </div>
          <div style={{ height: 16 }} />
        </div>
      )}

      {phase === 'generating' && (
        <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            border: `0.5px solid ${T.color.hairlineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.color.primary,
          }}>
            <IconSparkle size={24} strokeWidth={1.2} />
          </div>
          <div style={{ height: 24 }} />
          <div style={{ ...type.h3, color: T.color.primary, textAlign: 'center' }}>Composing outfits{'.'.repeat(dots)}</div>
          <div style={{ ...type.caption, marginTop: 12, textAlign: 'center' }}>
            Matching anchor pieces to your style and palette.
          </div>
          <div style={{ height: 32, width: '60%' }}>
            <div style={{ position: 'relative', height: 1, background: T.color.hairline, overflow: 'hidden', marginTop: 24 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', width: '40%',
                background: T.color.primary,
                animation: 'slide 1.5s ease-in-out infinite',
              }} />
            </div>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div style={{ overflow: 'auto', flex: 1, padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ ...type.h2, color: T.color.primary }}>{results.length} composed</div>
            <button onClick={() => setPhase('configure')} style={{
              ...type.ui, fontSize: 10, background: 'transparent', border: 'none',
              cursor: 'pointer', color: T.color.primary, textDecoration: 'underline',
              textUnderlineOffset: 3, padding: 0,
            }}>EDIT FILTERS</button>
          </div>
          <div style={{ ...type.caption, marginTop: 8 }}>
            Tap "Use this" to load an outfit into the canvas.
          </div>

          {results.length === 0 ? (
            <div style={{
              padding: '40px 16px', textAlign: 'center', marginTop: 24,
              border: `0.5px dashed ${T.color.hairlineStrong}`,
            }}>
              <div style={{ ...type.h3, color: T.color.primary }}>Nothing matches.</div>
              <div style={{ ...type.caption, marginTop: 8 }}>Loosen a filter and try again.</div>
            </div>
          ) : (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((r, i) => (
                <SuggestionCard key={i} suggestion={r} index={i + 1} onApply={() => onApply(r)} />
              ))}
            </div>
          )}
          <div style={{ height: 16 }} />
          <div style={{ textAlign: 'center' }}>
            <TextLink onClick={generate} color={T.color.primary} arrow>Re-generate</TextLink>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}
    </BottomSheet>
  );
}

function FilterRow({ label, hint, children }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>{label}</div>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, opacity: 0.7 }}>{hint}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, index, onApply }) {
  return (
    <div style={{
      border: `0.5px solid ${T.color.hairline}`,
      background: T.color.canvas,
      display: 'flex', gap: 12,
      padding: 12,
    }}>
      <div style={{
        width: 96, flexShrink: 0,
        aspectRatio: '3/4',
        background: T.color.elevated,
        position: 'relative', overflow: 'hidden',
      }}>
        <OutfitCollage outfit={suggestion} showTitle={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>OPTION {String(index).padStart(2, '0')}</div>
        <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 400, color: T.color.primary, marginTop: 4, lineHeight: 1.15 }}>
          {suggestion.title}
        </div>
        <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 }}>
          {suggestion.rationale}
        </div>
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {suggestion.tags.slice(0, 3).map(tag => (
            <div key={tag} style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{tag}</div>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <button onClick={onApply} style={{
          ...type.ui, fontSize: 10,
          padding: '10px 14px', alignSelf: 'flex-start',
          background: T.color.primary, color: T.color.canvas,
          border: 'none', cursor: 'pointer',
        }}>USE THIS →</button>
      </div>
    </div>
  );
}

// Lightweight composer that builds outfit candidates from a user's wardrobe.
// In a real app this would be a server-side recommender; here it's deterministic
// enough to feel intentional but seeded with the anchor + filters.
function generateOutfits({ items, anchorIds, styleFilter, colorFilter, occasionFilter }) {
  const anchorItems = anchorIds.map(id => items.find(i => i.id === id)).filter(Boolean);
  const anchorTypes = new Set(anchorItems.flatMap(i => {
    const b = BUILDER_BUCKETS.find(bb => bb.types.includes(i.type));
    return b ? [b.key] : [];
  }));

  // Pools by bucket — exclude anchors so we can fill gaps
  const pools = {};
  for (const b of BUILDER_BUCKETS) {
    pools[b.key] = items.filter(i => b.types.includes(i.type) && !anchorIds.includes(i.id));
  }

  // Color tag → palette names
  const colorBuckets = COLORS.reduce((acc, c) => { (acc[c.tag] ||= []).push(c.name); return acc; }, {});
  const preferredColors = colorFilter ? colorBuckets[colorFilter] : null;
  const matchesColor = (item) => !preferredColors || preferredColors.includes(item.color);

  // Build N variations
  const variations = [];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const sel = {};
    // Anchors locked in
    for (const a of anchorItems) {
      const b = BUILDER_BUCKETS.find(bb => bb.types.includes(a.type));
      if (b) sel[b.key] = a.id;
    }
    // Fill gaps — prefer matching color
    for (const b of BUILDER_BUCKETS) {
      if (sel[b.key]) continue;
      const pool = pools[b.key];
      if (pool.length === 0) continue;
      // OUTERWEAR / BAGS are optional — include with diminishing probability
      const optional = ['OUTERWEAR', 'BAGS'].includes(b.key);
      if (optional && Math.random() > 0.55) continue;
      const preferred = pool.filter(matchesColor);
      const list = preferred.length > 0 ? preferred : pool;
      const pick = list[(i * 3 + b.key.length) % list.length] || list[0];
      sel[b.key] = pick.id;
    }
    const itemIds = Object.values(sel).filter(Boolean);
    if (itemIds.length < 2) continue;

    // Compose title + rationale from anchors + filters
    const styleName = styleFilter ? STYLES.find(s => s.id === styleFilter)?.name : null;
    const colorName = colorFilter || null;
    const occName = occasionFilter || null;

    const titleParts = [];
    if (styleName) titleParts.push(styleName);
    if (anchorItems.length) titleParts.push(`with ${anchorItems[0].color || anchorItems[0].name}`);
    else titleParts.push(['Edit', 'Compose', 'Rotation', 'Layered', 'Quiet'][i % 5]);
    const title = titleParts.join(' · ') || 'Composed outfit';

    const rationaleParts = [];
    if (anchorItems.length) rationaleParts.push(`Built around ${anchorItems.map(a => a.name.toLowerCase()).slice(0, 2).join(' and ')}`);
    if (colorName) rationaleParts.push(`leaning ${colorName.toLowerCase()}`);
    if (styleName) rationaleParts.push(styleName.toLowerCase());
    const rationale = rationaleParts.join(' · ') + '.';

    const tags = [];
    if (occName) tags.push(occName);
    if (colorName) tags.push(colorName);
    if (styleName) tags.push(styleName.toUpperCase());
    if (tags.length === 0) tags.push('SUGGESTED', 'DAYTIME');

    variations.push({
      id: 'sug_' + i,
      title,
      subtitle: rationale.slice(0, 64),
      style: styleName || 'CUSTOM',
      context: occName || 'CASUAL',
      tags,
      rationale,
      tone: i,
      itemIds,
    });
  }
  // De-duplicate by item-set
  const seen = new Set();
  return variations.filter(v => {
    const k = [...v.itemIds].sort().join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ═════════════════════════════════════════════════════════════
// SCHEDULE OUTFITS  (week planner)
// ═════════════════════════════════════════════════════════════
function ScheduleOutfitsScreen({ onBack, outfits, savedSet, onOpenOutfit }) {
  // Mon-anchored 7-day window; user can flip to next week.
  const [weekOffset, setWeekOffset] = React.useState(0);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Seed sample scheduling — Mon, Wed, Fri get an outfit by default.
  const [plan, setPlan] = React.useState(() => {
    const base = {};
    base[fmtKey(days[0])] = 'o2';
    base[fmtKey(days[2])] = 'o4';
    base[fmtKey(days[4])] = 'o1';
    return base;
  });

  const [pickerFor, setPickerFor] = React.useState(null); // date key
  function fmtKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  const fmtMonth = (d) => d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
  const fmtWeekday = (d) => d.toLocaleDateString('en', { weekday: 'short' }).toUpperCase();
  const isToday = (d) => fmtKey(d) === fmtKey(today);

  // Toy weather forecasts so the cards have signal.
  const FORECASTS = ['24°C · clear', '22°C · partly cloudy', '26°C · sun', '19°C · overcast', '28°C · humid', '21°C · breeze', '23°C · sun'];

  const setOutfit = (key, id) => setPlan(p => ({ ...p, [key]: id }));
  const clearSlot = (key) => setPlan(p => { const n = { ...p }; delete n[key]; return n; });

  const filledCount = days.filter(d => plan[fmtKey(d)]).length;

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <ScreenHeader title="Schedule" onBack={onBack} rightIcon={<IconCalendar size={20} strokeWidth={1.4} />} onRight={() => setWeekOffset(0)} />

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 32px' }}>
        <div style={{ ...type.h1, color: T.color.primary }}>This week.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>
          Plan ahead — we'll surface each day's outfit in the morning.
        </div>

        {/* Week pager */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 28, marginBottom: 24,
        }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{
            ...type.ui, fontSize: 10, background: 'transparent', border: 'none',
            cursor: 'pointer', color: T.color.primary, padding: '6px 0',
          }}>← PREV WEEK</button>
          <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>
            {fmtMonth(days[0])} {days[0].getDate()} – {fmtMonth(days[6])} {days[6].getDate()}
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{
            ...type.ui, fontSize: 10, background: 'transparent', border: 'none',
            cursor: 'pointer', color: T.color.primary, padding: '6px 0',
          }}>NEXT WEEK →</button>
        </div>

        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>
          {filledCount} / 7 PLANNED
        </div>

        {/* Day cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {days.map((d, i) => {
            const k = fmtKey(d);
            const outfit = plan[k] ? outfits.find(o => o.id === plan[k]) : null;
            return (
              <DayCard key={k}
                date={d}
                fmtMonth={fmtMonth(d)}
                fmtWeekday={fmtWeekday(d)}
                isToday={isToday(d)}
                weather={FORECASTS[i]}
                outfit={outfit}
                onPlan={() => setPickerFor(k)}
                onOpen={() => outfit && onOpenOutfit(outfit.id)}
                onSwap={() => setPickerFor(k)}
                onClear={() => clearSlot(k)} />
            );
          })}
        </div>
      </div>

      {/* Outfit picker */}
      <OutfitPickerSheet
        open={!!pickerFor}
        onClose={() => setPickerFor(null)}
        outfits={outfits}
        preferIds={[...savedSet]}
        onPick={(id) => { if (pickerFor) setOutfit(pickerFor, id); setPickerFor(null); }}
      />
    </div>
  );
}

function DayCard({ date, fmtMonth, fmtWeekday, isToday, weather, outfit, onPlan, onOpen, onSwap, onClear }) {
  const num = date.getDate();
  return (
    <div style={{
      border: `0.5px solid ${isToday ? T.color.primary : T.color.hairline}`,
      background: T.color.canvas,
      display: 'flex', alignItems: 'stretch',
      minHeight: 120,
    }}>
      {/* Date column */}
      <div style={{
        flexShrink: 0, width: 84,
        borderRight: `0.5px solid ${T.color.hairline}`,
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        background: isToday ? T.color.elevated : 'transparent',
      }}>
        <div style={{ ...type.ui, fontSize: 9, color: isToday ? T.color.primary : T.color.tertiary }}>{fmtWeekday}</div>
        <div style={{ fontFamily: T.font.serif, fontSize: 32, fontWeight: 300, color: T.color.primary, marginTop: 4, lineHeight: 1 }}>
          {String(num).padStart(2, '0')}
        </div>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 4 }}>{fmtMonth}</div>
        {isToday && (
          <div style={{ ...type.ui, fontSize: 9, color: T.color.primary, marginTop: 12, padding: '2px 6px', border: `0.5px solid ${T.color.primary}` }}>TODAY</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 14px 8px',
          ...type.caption, fontSize: 11, color: T.color.tertiary,
          borderBottom: `0.5px solid ${T.color.hairline}`,
        }}>{weather}</div>
        {outfit ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
            <div onClick={onOpen} style={{
              flexShrink: 0, width: 76, position: 'relative',
              cursor: 'pointer',
              background: T.color.elevated,
              borderRight: `0.5px solid ${T.color.hairline}`,
              overflow: 'hidden',
            }}>
              <Photo src={outfit.img} label={outfit.title} tone={outfit.tone} />
            </div>
            <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div onClick={onOpen} style={{ cursor: 'pointer' }}>
                <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{outfit.style}</div>
                <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 400, color: T.color.primary, marginTop: 4, lineHeight: 1.15 }}>{outfit.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={onSwap} style={{
                  ...type.ui, fontSize: 10, padding: 0, background: 'transparent',
                  border: 'none', cursor: 'pointer', color: T.color.primary,
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>SWAP</button>
                <button onClick={onClear} style={{
                  ...type.ui, fontSize: 10, padding: 0, background: 'transparent',
                  border: 'none', cursor: 'pointer', color: T.color.tertiary,
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>CLEAR</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={onPlan} style={{
            flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10,
            padding: '0 14px',
            textAlign: 'left', color: T.color.tertiary,
          }}>
            <div style={{
              width: 28, height: 28,
              border: `0.5px dashed ${T.color.hairlineStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconPlus size={14} strokeWidth={1.4} color={T.color.tertiary} />
            </div>
            <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>PLAN OUTFIT</div>
          </button>
        )}
      </div>
    </div>
  );
}

function OutfitPickerSheet({ open, onClose, outfits, preferIds = [], onPick }) {
  const preferred = preferIds && preferIds.length > 0;
  const ordered = preferred
    ? [...outfits.filter(o => preferIds.includes(o.id)), ...outfits.filter(o => !preferIds.includes(o.id))]
    : outfits;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ ...type.h2, color: T.color.primary }}>Pick an outfit</div>
        <div style={{ ...type.caption, marginTop: 8 }}>
          {preferred ? 'Saved outfits surface first.' : 'From your saved + recent outfits.'}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {ordered.map(o => (
            <div key={o.id} onClick={() => onPick(o.id)} style={{
              cursor: 'pointer', position: 'relative',
              aspectRatio: '3/4', overflow: 'hidden',
              border: `0.5px solid ${T.color.hairline}`,
            }}>
              <Photo src={o.img} label={o.title} tone={o.tone} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', background: 'linear-gradient(to top, rgba(26,24,21,0.7), transparent)' }} />
              <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>
                <div style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.85)' }}>{o.style}</div>
                <div style={{ fontFamily: T.font.serif, fontSize: 14, color: T.color.canvas, marginTop: 4, lineHeight: 1.15 }}>{o.title}</div>
              </div>
              {preferIds.includes(o.id) && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 24, height: 24, borderRadius: 999,
                  background: 'rgba(250,247,242,0.92)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary,
                }}>
                  <IconBookmark size={11} strokeWidth={1.4} filled />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}

Object.assign(window, {
  SavedOutfitsScreen, OutfitBuilderScreen, WardrobeIntroScreen,
  MenuScreen, StylesEditScreen, ColorsEditScreen, MeasurementsEditScreen,
  ScheduleOutfitsScreen, SuggestSheet,
});
