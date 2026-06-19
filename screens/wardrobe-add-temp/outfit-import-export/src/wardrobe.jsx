// wardrobe.jsx — Wardrobe screen + Add Item flow + Collections + Profile + Menu Sheet

// ═════════════════════════════════════════════════════════════
// WARDROBE
// ═════════════════════════════════════════════════════════════
function WardrobeScreen({ items, onAdd, onOpenItem, onMenu, activeTab, onTabChange, onOpenCollections, collections }) {
  const [filter, setFilter] = React.useState('ALL');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const counts = {
    ALL: items.length,
    TOPS: items.filter(i => ['SHIRT', 'KNIT', 'TEE'].includes(i.type)).length,
    BOTTOMS: items.filter(i => ['JEANS', 'TROUSERS', 'CHINOS'].includes(i.type)).length,
    OUTERWEAR: items.filter(i => ['BLAZER', 'COAT'].includes(i.type)).length,
    FOOTWEAR: items.filter(i => ['LOAFERS', 'SNEAKERS'].includes(i.type)).length,
    ACCESSORIES: items.filter(i => ['BELT', 'SCARF'].includes(i.type)).length,
  };

  const filtered = filter === 'ALL' ? items :
    filter === 'TOPS' ? items.filter(i => ['SHIRT', 'KNIT', 'TEE'].includes(i.type)) :
    filter === 'BOTTOMS' ? items.filter(i => ['JEANS', 'TROUSERS', 'CHINOS'].includes(i.type)) :
    filter === 'OUTERWEAR' ? items.filter(i => ['BLAZER', 'COAT'].includes(i.type)) :
    filter === 'FOOTWEAR' ? items.filter(i => ['LOAFERS', 'SNEAKERS'].includes(i.type)) :
    filter === 'ACCESSORIES' ? items.filter(i => ['BELT', 'SCARF'].includes(i.type)) :
    items;

  const searchFiltered = search
    ? filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      {/* Nav */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <button onClick={() => setSearchOpen(!searchOpen)} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconSearch size={20} strokeWidth={1.4} />
        </button>
        <div style={{ ...type.h3, color: T.color.primary }}>Wardrobe</div>
        <button onClick={onAdd} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconPlus size={20} strokeWidth={1.4} />
        </button>
      </div>

      {searchOpen && (
        <div style={{ padding: '0 24px 8px' }}>
          <Field label="" value={search} onChange={setSearch} placeholder="Search items…" autoFocus />
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        height: 48, borderBottom: `0.5px solid ${T.color.hairline}`,
        display: 'flex', alignItems: 'center', overflowX: 'auto',
        padding: '0 24px', gap: 8, flexShrink: 0, scrollbarWidth: 'none',
      }}>
        {['ALL', 'TOPS', 'BOTTOMS', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORIES'].map(f => (
          <Tag key={f} selected={filter === f} onClick={() => setFilter(f)} size="sm">
            {f} ({counts[f] || 0})
          </Tag>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 100px' }}>
        {searchFiltered.length === 0 ? (
          <WardrobeEmpty onAdd={onAdd} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {searchFiltered.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => onOpenItem(item.id)} />
              ))}
            </div>

            {/* Collections section */}
            {collections && collections.length > 0 && (
              <>
                <div style={{ height: 40 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>COLLECTIONS</div>
                  <TextLink onClick={onOpenCollections} color={T.color.primary}>VIEW ALL</TextLink>
                </div>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginLeft: -24, marginRight: -24, padding: '0 24px', scrollbarWidth: 'none' }}>
                  {collections.map(c => (
                    <CollectionMiniCard key={c.id} collection={c} onClick={onOpenCollections} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Floating add */}
      <button onClick={onAdd} style={{
        position: 'absolute', right: 24, bottom: 88,
        width: 56, height: 56, borderRadius: 999,
        background: T.color.primary, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.color.canvas,
        boxShadow: '0 4px 16px rgba(26, 24, 21, 0.18)',
        zIndex: 5,
      }}>
        <IconPlus size={24} strokeWidth={1.4} />
      </button>

      <BottomNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}

function ItemCard({ item, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{
        width: '100%', aspectRatio: '3/4',
        background: T.color.elevated,
        border: `0.5px solid ${T.color.hairline}`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        {item.png ? (
          <img src={item.png} alt={item.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: item.pngBlend ? 'multiply' : 'normal' }} />
        ) : (
          <span style={{ ...type.micro, fontSize: 11, color: T.color.tertiary, textAlign: 'center', lineHeight: 1.2 }}>{item.type}</span>
        )}
      </div>
      <div style={{ padding: '12px 4px 0' }}>
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>{item.type}</div>
        <div style={{ height: 4 }} />
        <div style={{
          fontFamily: T.font.serif, fontSize: 15, fontWeight: 400, color: T.color.primary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{item.name}</div>
        <div style={{ height: 4 }} />
        <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary }}>
          Worn {item.wornCount}× · Added {item.addedDate}
        </div>
      </div>
    </div>
  );
}

function CollectionMiniCard({ collection, onClick }) {
  const outfits = collection.outfitIds.map(id => OUTFITS.find(o => o.id === id)).filter(Boolean);
  return (
    <div onClick={onClick} style={{
      flexShrink: 0, width: 140, cursor: 'pointer',
    }}>
      <div style={{ width: 140, height: 180, border: `0.5px solid ${T.color.hairline}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: T.color.hairline }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: T.color.elevated, overflow: 'hidden' }}>
            {outfits[i] && <Photo src={outfits[i].img} label="" tone={outfits[i].tone} />}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: T.font.serif, fontSize: 15, fontWeight: 400, color: T.color.primary }}>
          {collection.name}
        </div>
        <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 2 }}>
          {outfits.length} outfits
        </div>
      </div>
    </div>
  );
}

function WardrobeEmpty({ onAdd }) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke={T.color.primary} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto', display: 'block' }}>
        <path d="M40 18a3 3 0 11.5-5.9c2 .5 2.5 2 2.5 4v3L18 36h44L48 18.5" />
        <circle cx="40" cy="12" r="0.8" fill={T.color.primary} />
      </svg>
      <div style={{ height: 24 }} />
      <div style={{ ...type.h2, color: T.color.primary }}>No items yet.</div>
      <div style={{ ...type.caption, marginTop: 12, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
        Start by adding what you already own.
      </div>
      <div style={{ height: 32 }} />
      <PrimaryButton onClick={onAdd} fullWidth={false} style={{ padding: '0 48px' }}>ADD FIRST ITEM</PrimaryButton>
      <div style={{ height: 16 }} />
      <TextLink color={T.color.primary} arrow>Or import from order history</TextLink>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ADD ITEM FLOW
// ═════════════════════════════════════════════════════════════
function AddItemSheet({ open, onClose, onAdded, onOutfitImport }) {
  const [step, setStep] = React.useState('method'); // method, guide, capture, library, orders, processing, review
  const [photo, setPhoto] = React.useState(null);
  const [name, setName] = React.useState('');
  const [attrs, setAttrs] = React.useState({
    type: 'Blazer', color: 'Beige', material: 'Linen',
    pattern: 'Solid', occasion: ['Smart casual'], season: ['Spring', 'Summer'],
  });
  // user-entered details (separate from AI-detected attributes)
  const [details, setDetails] = React.useState({
    brand: '', size: '', purchasePrice: '', purchaseDate: '',
    purchasedAt: '', care: [], notes: '',
  });

  React.useEffect(() => {
    if (!open) setTimeout(() => {
      setStep('method'); setPhoto(null); setName('');
      setAttrs({
        type: 'Blazer', color: 'Beige', material: 'Linen',
        pattern: 'Solid', occasion: ['Smart casual'], season: ['Spring', 'Summer'],
      });
      setDetails({ brand: '', size: '', purchasePrice: '', purchaseDate: '', purchasedAt: '', care: [], notes: '' });
    }, 500);
  }, [open]);

  const pickMethod = (id) => {
    if (id === 'item') setStep('guide');
    if (id === 'photo')  setStep('capture');
    if (id === 'upload') setStep('library');
    if (id === 'import') setStep('orders');
    if (id === 'outfit') { onClose(); setTimeout(() => onOutfitImport && onOutfitImport(), 260); }
  };

  const takePhoto = () => {
    setPhoto(PHOTOS.detail_2);
    setStep('processing');
    setTimeout(() => setStep('review'), 2200);
  };

  const pickFromLibrary = (src) => {
    setPhoto(src);
    setStep('processing');
    setTimeout(() => setStep('review'), 1500);
  };

  const importOrder = (order) => {
    // import already has brand, size, price, date — skip the AI analyze step
    setPhoto(order.img);
    setName(order.name);
    setAttrs(a => ({ ...a, type: order.type, color: order.color, material: order.material }));
    setDetails(d => ({
      ...d,
      brand: order.brand, size: order.size,
      purchasePrice: order.price, purchaseDate: order.date,
      purchasedAt: order.retailer,
    }));
    setStep('review');
  };

  const finalize = () => {
    onAdded({ name: name || 'New item', ...attrs, ...details, img: photo });
    onClose();
  };

  const heightForStep = step === 'method' ? '64%'
    : step === 'guide' ? '78%'
    : step === 'review' ? '94%'
    : step === 'orders' || step === 'library' ? '88%'
    : '90%';

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight={heightForStep}>
      {step === 'method' && <MethodStep onSelect={pickMethod} />}
      {step === 'guide' && <ItemGuideStep onCamera={() => setStep('capture')} onLibrary={() => setStep('library')} onCancel={() => setStep('method')} />}
      {step === 'capture' && <CaptureStep onTake={takePhoto} onCancel={() => setStep('guide')} />}
      {step === 'library' && <LibraryStep onPick={pickFromLibrary} onCancel={() => setStep('guide')} />}
      {step === 'orders' && <OrderHistoryStep onPick={importOrder} onCancel={() => setStep('method')} />}
      {step === 'processing' && <ProcessingStep photo={photo} />}
      {step === 'review' && (
        <ReviewStep
          photo={photo} attrs={attrs} setAttrs={setAttrs}
          details={details} setDetails={setDetails}
          name={name} setName={setName}
          onAdd={finalize} onCancel={() => onClose()}
        />
      )}
    </BottomSheet>
  );
}

function MethodStep({ onSelect }) {
  const opts = [
    {
      id: 'item', title: 'Extract by item', badge: 'FREE',
      icon: <IconDashedSquare size={26} strokeWidth={1.3} />,
      desc: 'Place one item on a plain background. Your phone cuts it out and reads the details.',
      meta: 'On-device · Works offline · One item at a time',
    },
    {
      id: 'outfit', title: 'Extract by AI', feature: true,
      icon: <IconSparkle size={26} strokeWidth={1.3} />,
      desc: 'Snap a full outfit — or several. AI finds every piece and fills in colour, fabric, measurements and tags.',
      meta: 'Best for full looks · Multiple photos at once',
    },
  ];
  return (
    <div style={{ padding: '24px 24px 32px' }}>
      <div style={{ ...type.h2, color: T.color.primary }}>Add to your wardrobe</div>
      <div style={{ ...type.caption, marginTop: 8 }}>Choose how you’d like to capture your pieces.</div>
      <div style={{ height: 22 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {opts.map((o) => (
          <div key={o.id} onClick={() => onSelect(o.id)} style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            padding: 20,
            border: o.feature ? 'none' : `0.5px solid ${T.color.hairlineStrong}`, borderRadius: 2,
            background: o.feature ? T.color.accent : 'transparent',
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: o.feature ? T.color.canvas : T.color.primary, flexShrink: 0 }}>{o.icon}</div>
              {o.badge && (
                <span style={{ ...type.ui, fontSize: 9, color: T.color.canvas, background: T.color.primary, padding: '4px 9px', borderRadius: 999 }}>{o.badge}</span>
              )}
              {o.feature && (
                <span style={{ ...type.ui, fontSize: 9, color: T.color.canvas, border: '0.5px solid rgba(250,247,242,0.4)', padding: '4px 9px', borderRadius: 999 }}>AI</span>
              )}
            </div>
            <div>
              <div style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: 400, color: o.feature ? T.color.canvas : T.color.primary }}>{o.title}</div>
              <div style={{ ...type.caption, fontSize: 13, lineHeight: 1.5, color: o.feature ? 'rgba(250,247,242,0.7)' : T.color.secondary, marginTop: 6, textWrap: 'pretty' }}>{o.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTop: `0.5px solid ${o.feature ? 'rgba(250,247,242,0.18)' : T.color.hairline}` }}>
              <span style={{ ...type.ui, fontSize: 9, color: o.feature ? 'rgba(250,247,242,0.6)' : T.color.tertiary }}>{o.meta}</span>
              <IconChevronRight size={14} strokeWidth={1.4} color={o.feature ? T.color.canvas : T.color.tertiary} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Guide before on-device item extraction ───
function ItemGuideStep({ onCamera, onLibrary, onCancel }) {
  const tips = [
    { good: true,  label: 'Plain, single-colour background' },
    { good: true,  label: 'One item, laid flat or hung' },
    { good: true,  label: 'Even lighting, no harsh shadows' },
    { good: false, label: 'Avoid busy or patterned surfaces' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <button onClick={onCancel} style={{ width: 36, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: T.color.primary }}>
            <IconChevronLeft size={20} strokeWidth={1.3} />
          </button>
          <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>EXTRACT BY ITEM · FREE</span>
        </div>

        {/* illustrative example */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: T.color.elevated, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '46%', height: '74%', position: 'relative' }}>
            <img src={'assets/items/jacket-harrington.png'} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', inset: -10, border: `1.5px dashed ${T.color.primary}` }} />
            <div style={{ position: 'absolute', top: -10, left: -10, ...type.ui, fontSize: 8, color: T.color.canvas, background: T.color.primary, padding: '3px 6px', transform: 'translateY(-100%)' }}>CUT OUT</div>
          </div>
        </div>

        <div style={{ ...type.h3, color: T.color.primary, marginTop: 22 }}>Place one item on a plain background</div>
        <div style={{ ...type.caption, marginTop: 8, textWrap: 'pretty' }}>
          Your phone separates the item and reads its colour, type and fabric on-device — nothing leaves your phone.
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tips.map((t) => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.good ? T.color.primary : 'transparent',
                border: t.good ? 'none' : `0.5px solid ${T.color.error}`,
                color: t.good ? T.color.canvas : T.color.error,
              }}>
                {t.good ? <IconCheck size={12} strokeWidth={2} /> : <IconX size={11} strokeWidth={2} />}
              </div>
              <span style={{ fontFamily: T.font.sans, fontSize: 14, color: T.color.secondary }}>{t.label}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 16 }} />
      </div>
      <div style={{ flexShrink: 0, padding: '14px 24px 24px', borderTop: `0.5px solid ${T.color.hairline}`, background: T.color.canvas }}>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginBottom: 12 }}>ADD A PHOTO</div>
        <SourcePicker compact onCamera={onCamera} onLibrary={onLibrary} />
      </div>
    </div>
  );
}

function CaptureStep({ onTake, onCancel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16,
        display: 'flex', justifyContent: 'space-between', zIndex: 10,
      }}>
        <button onClick={onCancel} style={{ width: 44, height: 44, background: 'rgba(26,24,21,0.4)', borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.canvas }}>
          <IconX size={20} strokeWidth={1.4} />
        </button>
        <button style={{ width: 44, height: 44, background: 'rgba(26,24,21,0.4)', borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.canvas }}>
          <IconFlash size={18} strokeWidth={1.4} />
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#1A1815' }}>
        <Photo src={PHOTOS.detail_3} label="VIEWFINDER" tone={3} />
        <div style={{
          position: 'absolute', inset: 32,
          border: `1px solid rgba(242, 237, 228, 0.4)`, pointerEvents: 'none',
        }} />
      </div>
      <div style={{
        padding: '24px', background: T.color.canvas,
        display: 'flex', justifyContent: 'center',
      }}>
        <button onClick={onTake} style={{
          width: 72, height: 72, borderRadius: 999,
          background: T.color.canvas,
          border: `4px solid ${T.color.primary}`,
          cursor: 'pointer',
        }} />
      </div>
    </div>
  );
}

function ProcessingStep({ photo }) {
  const [dots, setDots] = React.useState(1);
  React.useEffect(() => {
    const i = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden', flexShrink: 0 }}>
        <Photo src={photo} label="ANALYZING" tone={3} />
      </div>
      <div style={{ height: 32 }} />
      <div style={{ position: 'relative', height: 1, background: T.color.hairline, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', width: '40%',
          background: T.color.primary,
          animation: 'slide 1.5s ease-in-out infinite',
        }} />
        <style>{`@keyframes slide { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
      </div>
      <div style={{ height: 16 }} />
      <div style={{ ...type.ui, fontSize: 11, color: T.color.primary, textAlign: 'center' }}>
        REMOVING BACKGROUND{'.'.repeat(dots)}
      </div>
      <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, textAlign: 'center', marginTop: 8 }}>
        Reading colour, type & fabric on-device
      </div>
    </div>
  );
}

function ReviewStep({ photo, attrs, setAttrs, details, setDetails, name, setName, onAdd, onCancel }) {
  // ─── editable single-select attribute row with inline chip picker ───
  const [editing, setEditing] = React.useState(null);

  const OPTIONS = {
    type:     ['Tee', 'Shirt', 'Knit', 'Blazer', 'Jacket', 'Coat', 'Jeans', 'Trousers', 'Chinos', 'Loafers', 'Sneakers'],
    color:    ['White', 'Cream', 'Beige', 'Camel', 'Grey', 'Black', 'Navy', 'Olive', 'Burgundy', 'Sage'],
    material: ['Cotton', 'Linen', 'Wool', 'Denim', 'Silk', 'Cashmere', 'Leather', 'Synthetic'],
    pattern:  ['Solid', 'Stripe', 'Check', 'Houndstooth', 'Print'],
  };
  const MULTI = {
    occasion: ['Casual', 'Smart casual', 'Office', 'Formal', 'Athleisure', 'Travel'],
    season:   ['Spring', 'Summer', 'Autumn', 'Winter'],
  };
  const CARE = ['Hand wash', 'Machine wash', 'Dry clean', 'Air dry only', 'No iron'];

  const swatchFor = (c) => ({
    White: '#F2EDE4', Cream: '#E8DFCC', Beige: '#D9C9A8', Camel: '#C49B6E',
    Grey: '#9C988F', Black: '#1A1815', Navy: '#22304B', Olive: '#5A5A30',
    Burgundy: '#5A1F23', Sage: '#7E8F73',
  }[c] || '#D9D2C5');

  const setSingle = (k, v) => { setAttrs(a => ({ ...a, [k]: v })); setEditing(null); };
  const toggleMulti = (k, v) => setAttrs(a => ({
    ...a, [k]: a[k].includes(v) ? a[k].filter(x => x !== v) : [...a[k], v],
  }));
  const toggleCare = (v) => setDetails(d => ({
    ...d, care: d.care.includes(v) ? d.care.filter(x => x !== v) : [...d.care, v],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ overflow: 'auto', flex: 1, padding: '8px 0 0' }}>
        {/* Photo hero */}
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '5/3', overflow: 'hidden',
          marginBottom: 20,
        }}>
          <Photo src={photo} label="ITEM" tone={3} />
          <button onClick={() => setEditing('photo')} style={{
            position: 'absolute', right: 16, bottom: 12,
            ...type.ui, fontSize: 9,
            padding: '7px 10px',
            background: 'rgba(250,247,242,0.92)', border: 'none',
            color: T.color.primary, cursor: 'pointer',
          }}>
            RETAKE
          </button>
        </div>

        <div style={{ padding: '0 24px' }}>
          {/* Name input */}
          <Field
            label="ITEM NAME"
            value={name}
            onChange={setName}
            placeholder="Beige linen blazer"
          />

          {/* Detected — editable single-select rows */}
          <SectionLabel hint="TAP TO EDIT" topGap={32}>DETECTED · AI</SectionLabel>
          {[
            { key: 'type', label: 'TYPE' },
            { key: 'color', label: 'COLOR', swatch: true },
            { key: 'material', label: 'MATERIAL' },
            { key: 'pattern', label: 'PATTERN' },
          ].map((f, i, arr) => {
            const open = editing === f.key;
            return (
              <div key={f.key} style={{
                borderBottom: i === arr.length - 1 ? `0.5px solid ${T.color.hairline}` : `0.5px solid ${T.color.hairline}`,
              }}>
                <div
                  onClick={() => setEditing(open ? null : f.key)}
                  style={{
                    display: 'flex', alignItems: 'center', height: 56,
                    cursor: 'pointer',
                  }}>
                  <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, width: 100 }}>{f.label}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.swatch && (
                      <div style={{
                        width: 16, height: 16, borderRadius: 999,
                        background: swatchFor(attrs[f.key]),
                        border: `0.5px solid ${T.color.hairline}`,
                      }} />
                    )}
                    <div style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.primary }}>{attrs[f.key]}</div>
                  </div>
                  <div style={{
                    transform: open ? 'rotate(90deg)' : 'rotate(0)',
                    transition: 'transform 200ms',
                    color: T.color.tertiary,
                  }}>
                    <IconChevronRight size={12} strokeWidth={1.4} />
                  </div>
                </div>
                {open && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                    padding: '4px 0 16px',
                  }}>
                    {OPTIONS[f.key].map(opt => (
                      <Tag key={opt} selected={attrs[f.key] === opt} onClick={() => setSingle(f.key, opt)}>
                        {f.key === 'color' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: 999,
                              background: swatchFor(opt),
                              border: `0.5px solid ${attrs[f.key] === opt ? T.color.canvas : T.color.hairlineStrong}`,
                            }} />
                            {opt}
                          </span>
                        ) : opt}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Multi-select chip groups */}
          <SectionLabel topGap={28}>OCCASION</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MULTI.occasion.map(o => (
              <Tag key={o} selected={attrs.occasion.includes(o)} onClick={() => toggleMulti('occasion', o)}>{o}</Tag>
            ))}
          </div>

          <SectionLabel topGap={28}>SEASON</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MULTI.season.map(o => (
              <Tag key={o} selected={attrs.season.includes(o)} onClick={() => toggleMulti('season', o)}>{o}</Tag>
            ))}
          </div>

          {/* User-entered details */}
          <SectionLabel topGap={32}>DETAILS · OPTIONAL</SectionLabel>
          <Field label="BRAND" value={details.brand} onChange={(v) => setDetails(d => ({ ...d, brand: v }))} placeholder="COS, Uniqlo, …" />
          <div style={{ height: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="SIZE" value={details.size} onChange={(v) => setDetails(d => ({ ...d, size: v }))} placeholder="M / 50 / 32" />
            <Field label="PRICE" value={details.purchasePrice} onChange={(v) => setDetails(d => ({ ...d, purchasePrice: v }))} placeholder="$0.00" />
          </div>
          <div style={{ height: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="PURCHASED" value={details.purchaseDate} onChange={(v) => setDetails(d => ({ ...d, purchaseDate: v }))} placeholder="YYYY-MM" />
            <Field label="WHERE" value={details.purchasedAt} onChange={(v) => setDetails(d => ({ ...d, purchasedAt: v }))} placeholder="Online · Store" />
          </div>

          {/* Care chips */}
          <SectionLabel topGap={28}>CARE</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CARE.map(c => (
              <Tag key={c} selected={details.care.includes(c)} onClick={() => toggleCare(c)}>{c}</Tag>
            ))}
          </div>

          {/* Notes */}
          <SectionLabel topGap={28}>NOTES</SectionLabel>
          <div style={{ position: 'relative', paddingBottom: 8 }}>
            <textarea
              value={details.notes}
              onChange={(e) => setDetails(d => ({ ...d, notes: e.target.value }))}
              placeholder="A reminder for future-you (e.g. runs slim, pair with denim)"
              rows={2}
              style={{
                width: '100%', resize: 'none',
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: T.font.sans, fontSize: 15, lineHeight: 1.5,
                color: T.color.primary, padding: 0,
              }}
            />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: 0.5, background: T.color.hairline,
            }} />
          </div>

          <div style={{ height: 24 }} />
          <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary }}>
            All fields are editable later from the item screen. AI suggestions improve with the more details you confirm.
          </div>
          <div style={{ height: 24 }} />
        </div>
      </div>

      {/* Sticky bottom */}
      <div style={{
        padding: '12px 24px 20px',
        borderTop: `0.5px solid ${T.color.hairline}`,
        background: T.color.canvas,
        flexShrink: 0,
      }}>
        <PrimaryButton onClick={onAdd}>ADD TO WARDROBE</PrimaryButton>
        <div style={{ height: 10 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onCancel} color={T.color.tertiary}>Discard</TextLink>
        </div>
      </div>
    </div>
  );
}

// ─── small reused label helper ──────────────────────────────────
function SectionLabel({ children, hint = null, topGap = 28 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: topGap, marginBottom: 12,
    }}>
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>{children}</div>
      {hint && <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, opacity: 0.7 }}>{hint}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// LIBRARY PICKER (Upload from library)
// ═════════════════════════════════════════════════════════════
function LibraryStep({ onPick, onCancel }) {
  const LIBRARY = [
    PHOTOS.detail_2, PHOTOS.detail_1, PHOTOS.detail_3,
    PHOTOS.outfit_1, PHOTOS.outfit_3, PHOTOS.outfit_5,
    PHOTOS.outfit_2, PHOTOS.outfit_4, PHOTOS.outfit_6,
    PHOTOS.outfit_7, PHOTOS.outfit_8, PHOTOS.detail_2,
  ];
  const [picked, setPicked] = React.useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
      }}>
        <button onClick={onCancel} style={{
          ...type.ui, fontSize: 10, padding: '8px 12px', background: 'transparent',
          border: 'none', color: T.color.tertiary, cursor: 'pointer',
        }}>CANCEL</button>
        <div style={{ ...type.h3, color: T.color.primary }}>Library</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{
        padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `0.5px solid ${T.color.hairline}`,
      }}>
        <div style={{
          ...type.ui, fontSize: 9,
          padding: '6px 10px', background: T.color.primary, color: T.color.canvas,
        }}>RECENTS</div>
        <div style={{ ...type.ui, fontSize: 9, padding: '6px 10px', color: T.color.tertiary }}>ALBUMS</div>
        <div style={{ ...type.ui, fontSize: 9, padding: '6px 10px', color: T.color.tertiary }}>SCREENSHOTS</div>
        <div style={{ flex: 1 }} />
        <button style={{
          ...type.ui, fontSize: 9, padding: '6px 8px', background: 'transparent',
          border: 'none', color: T.color.primary, cursor: 'pointer',
        }}>SELECT MULTIPLE</button>
      </div>

      <div style={{
        flex: 1, overflow: 'auto', padding: 4,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
      }}>
        {LIBRARY.map((src, i) => {
          const isPicked = picked === i;
          return (
            <div key={i} onClick={() => setPicked(i)} style={{
              position: 'relative', aspectRatio: '1/1', cursor: 'pointer', overflow: 'hidden',
            }}>
              <Photo src={src} label="" tone={(i + 1) % 5} />
              {isPicked && (
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,21,0.25)' }} />
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 22, height: 22, borderRadius: 999,
                    background: T.color.primary, color: T.color.canvas,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconCheck size={12} strokeWidth={2} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '12px 24px 20px',
        borderTop: `0.5px solid ${T.color.hairline}`,
        background: T.color.canvas,
        flexShrink: 0,
      }}>
        <PrimaryButton onClick={() => picked != null && onPick(LIBRARY[picked])} disabled={picked == null}>
          {picked == null ? 'PICK A PHOTO' : 'USE THIS PHOTO'}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ORDER HISTORY (Import from connected accounts)
// ═════════════════════════════════════════════════════════════
function OrderHistoryStep({ onPick, onCancel }) {
  // Mock orders that would come from a connected retailer
  const ORDERS = [
    { id: 'o_1', retailer: 'COS',        brand: 'COS',        name: 'Oversized wool coat',     img: PHOTOS.outfit_1, type: 'Coat',    color: 'Camel', material: 'Wool',   size: 'M',  price: '$315', date: '2025-11' },
    { id: 'o_2', retailer: 'UNIQLO',     brand: 'Uniqlo U',   name: 'Wide trousers, charcoal', img: PHOTOS.outfit_2, type: 'Trousers',color: 'Grey',  material: 'Wool',   size: '32', price: '$59',  date: '2025-10' },
    { id: 'o_3', retailer: 'MR PORTER',  brand: 'Drake\u2019s',name: 'Shetland crewneck',      img: PHOTOS.outfit_5, type: 'Knit',    color: 'Cream', material: 'Wool',   size: 'M',  price: '$245', date: '2025-09' },
    { id: 'o_4', retailer: 'ARKET',      brand: 'Arket',      name: 'Striped poplin shirt',    img: PHOTOS.outfit_7, type: 'Shirt',   color: 'White', material: 'Cotton', size: 'M',  price: '$89',  date: '2025-08' },
    { id: 'o_5', retailer: 'COS',        brand: 'COS',        name: 'Pleated chinos, beige',   img: PHOTOS.outfit_3, type: 'Chinos',  color: 'Beige', material: 'Cotton', size: '32', price: '$110', date: '2025-08' },
    { id: 'o_6', retailer: 'SUITSUPPLY', brand: 'Suitsupply', name: 'Navy linen blazer',       img: PHOTOS.outfit_4, type: 'Blazer',  color: 'Navy',  material: 'Linen',  size: '50', price: '$399', date: '2025-07' },
  ];
  const [filter, setFilter] = React.useState('ALL');
  const retailers = ['ALL', ...new Set(ORDERS.map(o => o.retailer))];
  const list = filter === 'ALL' ? ORDERS : ORDERS.filter(o => o.retailer === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
      }}>
        <button onClick={onCancel} style={{
          ...type.ui, fontSize: 10, padding: '8px 12px', background: 'transparent',
          border: 'none', color: T.color.tertiary, cursor: 'pointer',
        }}>CANCEL</button>
        <div style={{ ...type.h3, color: T.color.primary }}>Order history</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{
        padding: '12px 24px 20px',
      }}>
        <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary }}>
          Items from your connected retailers, ready to import with brand, size and price pre-filled.
        </div>
      </div>

      {/* Retailer filter chips */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        padding: '0 16px 12px', flexShrink: 0,
      }}>
        {retailers.map(r => (
          <Tag key={r} selected={filter === r} onClick={() => setFilter(r)} size="sm">{r}</Tag>
        ))}
      </div>

      {/* Order list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 8px' }}>
        {list.map(o => (
          <div key={o.id} onClick={() => onPick(o)} style={{
            display: 'flex', gap: 14, padding: '14px 8px',
            borderBottom: `0.5px solid ${T.color.hairline}`,
            cursor: 'pointer',
          }}>
            <div style={{
              width: 64, aspectRatio: '3/4', overflow: 'hidden',
              background: T.color.elevated, border: `0.5px solid ${T.color.hairline}`,
              flexShrink: 0,
            }}>
              <Photo src={o.img} label="" tone={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{o.retailer}</div>
              <div style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.primary, marginTop: 3, lineHeight: 1.2 }}>{o.name}</div>
              <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 }}>
                {o.brand} · {o.size} · {o.color}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{o.date}</div>
                <div style={{ fontFamily: T.font.serif, fontSize: 14, color: T.color.primary }}>{o.price}</div>
              </div>
            </div>
            <IconChevronRight size={12} strokeWidth={1.4} color={T.color.tertiary} />
          </div>
        ))}

        {list.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary }}>
              No orders from this retailer yet. Connect one in Profile → Connected accounts.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// COLLECTIONS
// ═════════════════════════════════════════════════════════════
function CollectionsScreen({ onBack, onOpenCollection, collections }) {
  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconChevronLeft size={20} strokeWidth={1.4} />
        </button>
        <div style={{ ...type.h3, color: T.color.primary }}>Collections</div>
        <button style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconPlus size={20} strokeWidth={1.4} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {collections.map(c => {
            const outs = c.outfitIds.map(id => OUTFITS.find(o => o.id === id)).filter(Boolean);
            return (
              <div key={c.id} onClick={() => onOpenCollection(c.id)} style={{ cursor: 'pointer' }}>
                <div style={{ width: '100%', aspectRatio: '3/4', border: `0.5px solid ${T.color.hairline}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: T.color.hairline }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ background: T.color.elevated, overflow: 'hidden' }}>
                      {outs[i] && <Photo src={outs[i].img} label="" tone={outs[i].tone} />}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 4px 0' }}>
                  <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 400, color: T.color.primary }}>{c.name}</div>
                  <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 }}>
                    {outs.length} outfits · Updated 2 days ago
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CollectionDetailScreen({ collection, onBack, onOpenOutfit }) {
  const outs = collection.outfitIds.map(id => OUTFITS.find(o => o.id === id)).filter(Boolean);
  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconChevronLeft size={20} strokeWidth={1.4} />
        </button>
        <div style={{ ...type.h3, color: T.color.primary }}>{collection.name}</div>
        <button style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconEdit size={18} strokeWidth={1.4} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '24px 24px 32px' }}>
          <div style={{ ...type.h1, color: T.color.primary }}>{collection.name}</div>
          <div style={{ ...type.caption, marginTop: 12 }}>{collection.description}</div>
          <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 16 }}>
            {outs.length} OUTFITS · {collection.createdDate}
          </div>
        </div>
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {outs.map(o => (
              <div key={o.id} onClick={() => onOpenOutfit(o.id)} style={{ cursor: 'pointer', position: 'relative', aspectRatio: '3/4', overflow: 'hidden', border: `0.5px solid ${T.color.hairline}` }}>
                <Photo src={o.img} label={o.title} tone={o.tone} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%', background: 'linear-gradient(to top, rgba(26,24,21,0.7), transparent)' }} />
                <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                  <div style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.8)' }}>{o.style}</div>
                  <div style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.canvas, marginTop: 4 }}>{o.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PROFILE
// ═════════════════════════════════════════════════════════════
function ProfileScreen({ onBack, items, outfits, collections, onSignOut, onOpenSection, onSettings, onEditProfile }) {
  const stats = [
    { num: items.length, label: 'ITEMS' },
    { num: outfits.length, label: 'OUTFITS' },
    { num: collections.length, label: 'COLLECTIONS' },
  ];
  const sections = [
    { label: 'Style preferences' },
    { label: 'Color palette' },
    { label: 'Body measurements' },
    { label: 'Location & weather' },
    { label: 'Connected accounts' },
    { label: 'Notifications' },
    { label: 'Subscription' },
    { label: 'Shopping cart', soon: true },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: T.color.canvas, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconChevronLeft size={20} strokeWidth={1.4} />
        </button>
        <div style={{ width: 44 }} />
        <button onClick={onSettings} style={{ width: 44, height: 44, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.primary }}>
          <IconSettings size={20} strokeWidth={1.4} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 32px' }}>
        {/* Profile block */}
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            width: 96, height: 96, borderRadius: 999,
            background: T.color.elevated, border: `0.5px solid ${T.color.hairline}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            fontFamily: T.font.serif, fontSize: 32, fontWeight: 400, color: T.color.primary,
          }}>K</div>
          <div style={{ height: 16 }} />
          <div style={{ ...type.h2, color: T.color.primary }}>Khoi Nguyen</div>
          <div style={{ ...type.caption, fontSize: 12, marginTop: 4 }}>@khoi · Ho Chi Minh City</div>
          <div style={{ height: 24 }} />
          <TextLink color={T.color.primary} onClick={onEditProfile}>Edit profile</TextLink>
        </div>

        <div style={{ height: 24 }} />

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <Divider vertical />}
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 300, color: T.color.primary }}>{s.num}</div>
                <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 4 }}>{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div style={{ height: 32 }} />
        <Divider />
        <div style={{ height: 8 }} />

        {/* Sections */}
        {sections.map((s, i) => (
          <div key={s.label} onClick={() => onOpenSection && onOpenSection(s.label)} style={{
            display: 'flex', alignItems: 'center', height: 64,
            borderBottom: i === sections.length - 1 ? 'none' : `0.5px solid ${T.color.hairline}`,
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1, fontFamily: T.font.serif, fontSize: 17, fontWeight: 400, color: T.color.primary }}>{s.label}</div>
            {s.soon && (
              <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginRight: 12 }}>SOON</div>
            )}
            <IconChevronRight size={12} strokeWidth={1.4} color={T.color.tertiary} />
          </div>
        ))}

        <div style={{ height: 32 }} />
        <Divider />
        <div style={{ height: 24 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onSignOut} color={T.color.tertiary}>Sign out</TextLink>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ ...type.micro, color: T.color.tertiary, textAlign: 'center' }}>App version 1.0.0</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MENU SHEET (from central nav dot)
// ═════════════════════════════════════════════════════════════
function MenuSheet({ open, onClose, onOpenProfile, onOpenCollections, onSignOut }) {
  const items = [
    { icon: <IconDashedSquare size={22} strokeWidth={1.4} />, title: 'Build an outfit manually', action: () => {} },
    { icon: <IconCalendar size={22} strokeWidth={1.4} />, title: 'Schedule outfits', action: () => {} },
    { icon: <IconLayers size={22} strokeWidth={1.4} />, title: 'Collections', action: onOpenCollections },
    { icon: <IconPin size={22} strokeWidth={1.4} />, title: 'Trending in your area', action: () => {} },
    { icon: <IconBook size={22} strokeWidth={1.4} />, title: 'Style guide', action: () => {} },
    { icon: <IconUser size={22} strokeWidth={1.4} />, title: 'Profile', action: onOpenProfile },
    { icon: <IconSettings size={22} strokeWidth={1.4} />, title: 'Settings', action: () => {} },
    { icon: <IconChat size={22} strokeWidth={1.4} />, title: 'Help & feedback', action: () => {} },
  ];
  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <div style={{ padding: '24px 24px 0', overflow: 'auto', flex: 1 }}>
        <div style={{ ...type.h3, color: T.color.primary, marginTop: 8 }}>Menu</div>
        <div style={{ height: 24 }} />
        {items.map((it, i) => (
          <div key={i} onClick={() => { it.action(); onClose(); }} style={{
            display: 'flex', alignItems: 'center', gap: 16, height: 64,
            borderBottom: i === items.length - 1 ? 'none' : `0.5px solid ${T.color.hairline}`,
            cursor: 'pointer', color: T.color.primary,
          }}>
            {it.icon}
            <div style={{ flex: 1, fontFamily: T.font.serif, fontSize: 17, fontWeight: 400, color: T.color.primary }}>{it.title}</div>
            <IconChevronRight size={12} strokeWidth={1.4} color={T.color.tertiary} />
          </div>
        ))}
        <div style={{ height: 32 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onSignOut} color={T.color.tertiary}>Sign out</TextLink>
        </div>
        <div style={{ height: 32 }} />
      </div>
    </BottomSheet>
  );
}

Object.assign(window, {
  WardrobeScreen, AddItemSheet, MethodStep, ItemGuideStep, CollectionsScreen, CollectionDetailScreen,
  ProfileScreen, MenuSheet,
});
