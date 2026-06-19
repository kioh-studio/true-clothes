// outfit-import.jsx — "Upload outfit photos (AI)" wizard for TRUE CLOTHES
// Full-screen, 4 sequential steps:
//   1. Upload     — a GALLERY of photos (add / remove) + optional notes
//   2. Processing — scans through each photo one by one
//   3. Review     — extracted item cards, GROUPED under each source photo
//   4. Done       — confirmation with saved count
// Reached from AddItemSheet → "Upload outfit photo (AI)".

const OI_STEPS = ['Upload', 'Analyse', 'Review', 'Done'];

// A library of source photos, each with the items Claude Vision "extracts".
// Default selection is the first few; user can add the rest or remove any.
const OI_PHOTO_LIB = [
  {
    id: 'p1', photo: PHOTOS.outfit_4, label: 'OUTFIT 01',
    items: [
      { id: 'x1', png: 'assets/items/jacket-harrington.png', type: 'Jacket',  name: 'Beige harrington jacket', color: 'Beige',    fabric: 'Cotton',       tags: ['Outerwear', 'Smart casual', 'Spring'] },
      { id: 'x2', png: 'assets/items/tee-burgundy.png',      type: 'Tee',     name: 'Burgundy cotton tee',     color: 'Burgundy', fabric: 'Cotton',       tags: ['Everyday', 'Cotton'] },
      { id: 'x3', png: 'assets/items/jeans-blue.png',        type: 'Jeans',   name: 'Light wash jeans',        color: 'Indigo',   fabric: 'Denim',        tags: ['Casual', 'Denim'] },
      { id: 'x4', png: 'assets/items/loafers-black.png',     type: 'Loafers', name: 'Black penny loafers',     color: 'Black',    fabric: 'Leather',      tags: ['Leather', 'Formal'] },
    ],
  },
  {
    id: 'p2', photo: PHOTOS.outfit_3, label: 'OUTFIT 02',
    items: [
      { id: 'x5', png: 'assets/items/polo-olive.png',  type: 'Polo',  name: 'Olive knit polo',  color: 'Olive', fabric: 'Cotton', tags: ['Smart casual', 'Summer'] },
      { id: 'x6', png: 'assets/items/jeans-dark.png',  type: 'Jeans', name: 'Dark wash jeans',  color: 'Navy',  fabric: 'Denim',  tags: ['Everyday', 'Denim'] },
    ],
  },
  {
    id: 'p3', photo: PHOTOS.outfit_1, label: 'OUTFIT 03',
    items: [
      { id: 'x7', png: 'assets/items/sweater-black.png', type: 'Knit', name: 'Black crewneck',    color: 'Black', fabric: 'Wool',   tags: ['Knit', 'Winter'] },
      { id: 'x8', png: 'assets/items/tee-grey.png',      type: 'Tee',  name: 'Heather grey tee',  color: 'Grey',  fabric: 'Cotton', tags: ['Everyday', 'Cotton'] },
      { id: 'x9', png: 'assets/items/bag-black.png',     type: 'Bag',  name: 'Black nylon tote',  color: 'Black', fabric: 'Nylon',  tags: ['Everyday', 'Nylon'] },
    ],
  },
  {
    id: 'p4', photo: PHOTOS.outfit_5, label: 'OUTFIT 04',
    items: [
      { id: 'x10', png: 'assets/items/tee-airism.png', type: 'Tee',     name: 'White crew tee',  color: 'White', fabric: 'Cotton', tags: ['Everyday', 'Cotton'] },
      { id: 'x11', png: 'assets/items/jeans-blue.png', type: 'Jeans',   name: 'Mid wash jeans',  color: 'Indigo', fabric: 'Denim', tags: ['Casual', 'Denim'] },
    ],
  },
  {
    id: 'p5', photo: PHOTOS.outfit_2, label: 'OUTFIT 05',
    items: [
      { id: 'x12', png: 'assets/items/jacket-harrington.png', type: 'Jacket', name: 'Tan jacket',  color: 'Tan',   fabric: 'Cotton', tags: ['Outerwear', 'Spring'] },
      { id: 'x13', png: 'assets/items/loafers-black.png',     type: 'Loafers', name: 'Black loafers', color: 'Black', fabric: 'Leather', tags: ['Leather'] },
    ],
  },
  {
    id: 'p6', photo: PHOTOS.outfit_6, label: 'OUTFIT 06',
    items: [
      { id: 'x14', png: 'assets/items/polo-olive.png', type: 'Polo', name: 'Olive polo', color: 'Olive', fabric: 'Cotton', tags: ['Smart casual'] },
    ],
  },
];

const OI_FABRICS = ['Cotton', 'Linen', 'Wool', 'Cashmere', 'Denim', 'Leather', 'Suede', 'Silk', 'Nylon', 'Polyester', 'Corduroy', 'Tweed', 'Blend'];

const OI_TYPES  = ['Tee', 'Shirt', 'Knit', 'Polo', 'Blazer', 'Jacket', 'Coat', 'Jeans', 'Trousers', 'Chinos', 'Loafers', 'Sneakers', 'Boots', 'Bag'];
const OI_COLORS = [
  'White', 'Off-white', 'Cream', 'Beige', 'Tan', 'Camel', 'Khaki', 'Mustard', 'Brown', 'Chocolate', 'Rust', 'Terracotta',
  'Light grey', 'Grey', 'Charcoal', 'Black',
  'Sky blue', 'Blue', 'Navy', 'Indigo', 'Teal',
  'Sage', 'Green', 'Olive', 'Forest',
  'Pink', 'Coral', 'Red', 'Burgundy', 'Maroon',
  'Lavender', 'Purple', 'Yellow', 'Orange', 'Gold', 'Silver',
];

// ─── Measurements are type-aware: tops vs bottoms vs shoes vs bags ───
const OI_BOTTOM_TYPES = ['Jeans', 'Trousers', 'Chinos'];
const OI_SHOE_TYPES   = ['Loafers', 'Sneakers', 'Boots'];

function oiMeasureGroup(type) {
  if (OI_BOTTOM_TYPES.includes(type)) return 'bottom';
  if (OI_SHOE_TYPES.includes(type))   return 'shoe';
  if (type === 'Bag')                 return 'bag';
  return 'top';
}

// [key, label] pairs shown per group, in order
const OI_MEASURE_SCHEMA = {
  top:    [['chest', 'Chest'], ['shoulder', 'Shoulder'], ['length', 'Length'], ['sleeve', 'Sleeve']],
  bottom: [['waist', 'Waist'], ['hip', 'Hip'], ['inseam', 'Inseam'], ['length', 'Length']],
  shoe:   [['size', 'Size'], ['insole', 'Insole']],
  bag:    [['width', 'Width'], ['height', 'Height'], ['depth', 'Depth']],
};

// AI-estimated defaults pre-filled into each new item
const OI_MEASURE_DEFAULTS = {
  top:    { chest: '54 cm', shoulder: '46 cm', length: '70 cm', sleeve: '62 cm' },
  bottom: { waist: '82 cm', hip: '102 cm', inseam: '78 cm', length: '104 cm' },
  shoe:   { size: 'EU 42', insole: '27 cm' },
  bag:    { width: '34 cm', height: '30 cm', depth: '12 cm' },
};

const oiSwatch = (c) => ({
  White: '#F4F1EA', 'Off-white': '#ECE7DA', Cream: '#E8DFCC', Beige: '#D9C9A8', Tan: '#C9A877', Camel: '#C49B6E',
  Khaki: '#B0A06C', Mustard: '#C9962E', Brown: '#6E4A2E', Chocolate: '#4A3020', Rust: '#9C4A22', Terracotta: '#B5623F',
  'Light grey': '#C7C3BA', Grey: '#9C988F', Charcoal: '#3A3631', Black: '#1A1815',
  'Sky blue': '#8FB4CE', Blue: '#3D6A99', Navy: '#22304B', Indigo: '#35476B', Teal: '#2E6E6A',
  Sage: '#7E8F73', Green: '#4A7A4E', Olive: '#5A5A30', Forest: '#2E4A30',
  Pink: '#D9A3AE', Coral: '#D9755F', Red: '#A8322C', Burgundy: '#5A1F23', Maroon: '#421A20',
  Lavender: '#A89BC4', Purple: '#5E4A7E', Yellow: '#D9C24A', Orange: '#CC6B2C', Gold: '#B8923E', Silver: '#BFC0C2',
}[c] || '#D9D2C5');

// ─── Step indicator (4 dots + connectors + labels) ───
function OIStepper({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0 4px' }}>
      {OI_STEPS.map((label, i) => {
        const done = i < active;
        const cur = i === active;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, width: 44 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 999, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (done || cur) ? T.color.primary : 'transparent',
                border: (done || cur) ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
                transition: 'background 300ms ease-out',
              }}>
                {done
                  ? <IconCheck size={13} color={T.color.canvas} strokeWidth={1.8} />
                  : <span style={{ ...type.ui, fontSize: 10, color: cur ? T.color.canvas : T.color.tertiary }}>{i + 1}</span>}
              </div>
              <span style={{ ...type.ui, fontSize: 8, color: cur ? T.color.primary : T.color.tertiary, textAlign: 'center' }}>{label}</span>
            </div>
            {i < OI_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 0.5, background: i < active ? T.color.primary : T.color.hairlineStrong, marginTop: 13, transition: 'background 300ms' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Inline single-select chip picker (used for type & color) ───
function OIPicker({ label, value, options, swatch, onPick, onClose }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const sel = o === value;
          return (
            <button key={o} onClick={() => { onPick(o); onClose(); }} style={{
              ...type.ui, fontSize: 9, display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 12px', cursor: 'pointer', borderRadius: 999,
              border: sel ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
              background: sel ? T.color.primary : 'transparent',
              color: sel ? T.color.canvas : T.color.primary,
            }}>
              {swatch && <span style={{ width: 11, height: 11, borderRadius: 999, background: swatch(o), border: '0.5px solid rgba(26,24,21,0.15)' }} />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Editable field row (tap to edit name/brand text, or open picker) ───
function OIFieldRow({ label, value, onChange, picker, swatch, placeholder }) {
  const [editing, setEditing] = React.useState(false);
  if (picker) {
    return (
      <div style={{ padding: '12px 0', borderTop: `0.5px solid ${T.color.hairline}` }}>
        <button onClick={() => setEditing(e => !e)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {swatch && <span style={{ width: 12, height: 12, borderRadius: 999, background: swatch(value), border: '0.5px solid rgba(26,24,21,0.15)' }} />}
            <span style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.primary }}>{value}</span>
            <IconEdit size={13} strokeWidth={1.4} color={T.color.tertiary} />
          </span>
        </button>
        {editing && (
          <OIPicker
            label={`CHOOSE ${label}`} value={value}
            options={picker} swatch={swatch}
            onPick={onChange} onClose={() => setEditing(false)}
          />
        )}
      </div>
    );
  }
  // text field (brand / link / etc.)
  return (
    <div style={{ padding: '12px 0', borderTop: `0.5px solid ${T.color.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, flexShrink: 0 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        style={{
          flex: 1, minWidth: 0, textAlign: 'right', border: 'none', outline: 'none', background: 'transparent',
          fontFamily: T.font.sans, fontSize: 15, color: T.color.primary, textOverflow: 'ellipsis',
        }}
      />
    </div>
  );
}

// ─── Compact labelled measurement input (e.g. "Chest  54 cm") ───
function OIMeasureField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...type.ui, fontSize: 8, color: T.color.tertiary }}>{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px',
          background: T.color.elevated, border: `0.5px solid ${T.color.hairline}`, outline: 'none',
          fontFamily: T.font.sans, fontSize: 14, color: T.color.primary,
        }}
      />
    </div>
  );
}

// ─── Editable tag chips — remove with ×, add via input ───
function OITagEditor({ tags, onChange }) {
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {tags.map((t) => (
        <span key={t} style={{
          ...type.ui, fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 8px 6px 12px', borderRadius: 999, background: T.color.primary, color: T.color.canvas,
        }}>
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: T.color.canvas, padding: 0,
          }}>
            <IconX size={11} strokeWidth={1.8} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="Add tag…"
        style={{
          flex: '1 1 80px', minWidth: 70, padding: '6px 10px', border: `0.5px dashed ${T.color.hairlineStrong}`,
          borderRadius: 999, outline: 'none', background: 'transparent',
          fontFamily: T.font.sans, fontSize: 12, color: T.color.primary,
        }}
      />
    </div>
  );
}

// ─── One extracted-item card ───
function OIItemCard({ item, index, onChange, onRemove }) {
  const group = oiMeasureGroup(item.type);
  const schema = OI_MEASURE_SCHEMA[group] || [];
  const setMeasure = (key, val) => onChange({ ...item, measure: { ...(item.measure || {}), [key]: val } });
  return (
    <div style={{
      padding: 14, marginBottom: 12,
      background: T.color.canvas, border: `0.5px solid ${T.color.hairlineStrong}`,
    }}>
      {/* top: photo + name + category/colour/brand */}
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ width: 92, height: 116, flexShrink: 0, background: T.color.elevated, position: 'relative', overflow: 'hidden' }}>
          <img src={item.png} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', top: 6, left: 6, ...type.ui, fontSize: 8, color: T.color.canvas, background: 'rgba(26,24,21,0.62)', padding: '3px 6px' }}>
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <input
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: T.font.serif, fontSize: 18, fontWeight: 400, color: T.color.primary, padding: 0,
                textOverflow: 'ellipsis',
              }}
            />
            <button onClick={onRemove} style={{ ...type.ui, fontSize: 9, color: T.color.error, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 0' }}>
              REMOVE
            </button>
          </div>
          <div style={{ marginTop: 4 }}>
            <OIFieldRow label="CATEGORY" value={item.type}  onChange={(v) => onChange({ ...item, type: v })}  picker={OI_TYPES} />
            <OIFieldRow label="COLOUR"   value={item.color} onChange={(v) => onChange({ ...item, color: v })} picker={OI_COLORS} swatch={oiSwatch} />
            <OIFieldRow label="FABRIC"   value={item.fabric} onChange={(v) => onChange({ ...item, fabric: v })} picker={OI_FABRICS} />
            <OIFieldRow label="BRAND"    value={item.brand} onChange={(v) => onChange({ ...item, brand: v })} placeholder="Add brand" />
            <OIFieldRow label="LINK"     value={item.link} onChange={(v) => onChange({ ...item, link: v })} placeholder="Paste product link" />
          </div>
        </div>
      </div>

      {/* measurements (type-aware) */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.color.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>MEASUREMENTS</span>
          <span style={{ ...type.ui, fontSize: 8, color: T.color.tertiary }}>{group === 'bottom' ? 'BOTTOM' : group === 'shoe' ? 'FOOTWEAR' : group === 'bag' ? 'BAG' : 'TOP'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: schema.length <= 2 ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
          {schema.map(([key, label]) => (
            <OIMeasureField key={key} label={label} value={(item.measure || {})[key]} onChange={(v) => setMeasure(key, v)} />
          ))}
        </div>
      </div>

      {/* tags */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.color.hairline}` }}>
        <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginBottom: 10 }}>TAGS</div>
        <OITagEditor tags={item.tags || []} onChange={(next) => onChange({ ...item, tags: next })} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// OUTFIT IMPORT — full-screen wizard (multi-photo)
// ═════════════════════════════════════════════════════════════
function OutfitImportScreen({ photo, onClose, onSaved }) {
  const [step, setStep] = React.useState(0);            // 0 upload, 1 processing, 2 review, 3 done
  const [notes, setNotes] = React.useState({});          // per-photo notes, keyed by libId
  // chosen photos: [{ libId, method }] — method is 'ai' or 'item'
  const [chosen, setChosen] = React.useState([]);
  const [items, setItems] = React.useState([]);          // extracted, populated at analyse
  const [show, setShow] = React.useState(true);
  // chooser overlay: phase = null | 'method' | 'source' | 'library'
  const [chooser, setChooser] = React.useState({ phase: null, method: null });

  const usedIds = chosen.map((c) => c.libId);
  const remaining = OI_PHOTO_LIB.filter((p) => !usedIds.includes(p.id));
  const chosenEntries = chosen.map((c) => ({ ...c, set: OI_PHOTO_LIB.find((p) => p.id === c.libId) })).filter((e) => e.set);

  // open the chooser fresh (pick method, then source)
  const openChooser = () => { if (remaining.length) setChooser({ phase: 'method', method: null }); };
  const closeChooser = () => setChooser({ phase: null, method: null });
  const pickMethod = (m) => setChooser({ phase: 'source', method: m });
  const gotoLibrary = () => setChooser((c) => ({ ...c, phase: 'library' }));

  const addEntries = (libIds, method) => {
    setChosen((c) => [...c, ...libIds.filter((id) => !c.some((x) => x.libId === id)).map((id) => ({ libId: id, method }))]);
    closeChooser();
  };
  // camera adds ONE photo (the next available)
  const addByCamera = () => { if (remaining.length) addEntries([remaining[0].id], chooser.method); };
  const removeEntry = (libId) => setChosen((c) => c.filter((x) => x.libId !== libId));

  // auto-open the chooser the first time the screen opens empty
  React.useEffect(() => { if (chosen.length === 0) openChooser(); /* eslint-disable-next-line */ }, []);

  const analyse = () => {
    setStep(1);
    const built = [];
    chosenEntries.forEach((e) => {
      // AI reads every piece; on-device item extraction reads just the primary item
      const picked = e.method === 'ai' ? e.set.items : e.set.items.slice(0, 1);
      picked.forEach((it) => {
        const grp = oiMeasureGroup(it.type);
        built.push({
          ...it, srcId: e.libId, method: e.method,
          brand: it.brand || '', link: it.link || '', fabric: it.fabric || '',
          tags: it.tags ? [...it.tags] : [],
          measure: it.measure ? { ...it.measure } : { ...OI_MEASURE_DEFAULTS[grp] },
        });
      });
    });
    const dur = 1000 + chosenEntries.length * 1000;
    setTimeout(() => { setItems(built); setStep(2); }, dur);
  };
  const confirmAll = () => setStep(3);
  const removeItem = (id) => setItems((list) => list.filter((i) => i.id !== id));
  const updateItem = (next) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)));

  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      opacity: show ? 1 : 0, transition: 'opacity 360ms ease-out',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, paddingTop: STATUS_BAR_H,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${STATUS_BAR_H}px 16px 0`, height: STATUS_BAR_H + 52,
      }}>
        <button onClick={step === 0 ? onClose : undefined} style={{
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: step === 0 ? 'pointer' : 'default',
          color: T.color.primary, opacity: step === 0 ? 1 : 0,
        }}>
          <IconChevronLeft size={20} strokeWidth={1.2} />
        </button>
        <span style={{ ...type.ui, fontSize: 11, color: T.color.primary }}>ADD TO WARDROBE</span>
        <button onClick={onClose} style={{
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: T.color.tertiary,
        }}>
          <IconX size={18} strokeWidth={1.4} />
        </button>
      </div>

      {/* Stepper */}
      <div style={{ flexShrink: 0, padding: '4px 24px 18px' }}>
        <OIStepper active={step} />
      </div>

      {/* Step body */}
      {step === 0 && (
        <OIUpload
          entries={chosenEntries} canAdd={remaining.length > 0}
          notes={notes} setNote={(id, v) => setNotes((m) => ({ ...m, [id]: v }))}
          onAdd={openChooser} onRemove={removeEntry} onAnalyse={analyse}
        />
      )}
      {step === 1 && <OIProcessing entries={chosenEntries} />}
      {step === 2 && (
        <OIReview
          items={items} entries={chosenEntries}
          onChange={updateItem} onRemove={removeItem}
          onConfirm={confirmAll}
        />
      )}
      {step === 3 && <OIDone count={items.length} photoCount={chosenEntries.length} onDone={() => onSaved(items)} onClose={onClose} />}

      {/* Two-phase add chooser: method → source → (library multi-select) */}
      {chooser.phase && (
        <OIAddChooser
          phase={chooser.phase} method={chooser.method} remaining={remaining}
          dismissable={chosen.length > 0}
          onPickMethod={pickMethod} onCamera={addByCamera} onGotoLibrary={gotoLibrary}
          onConfirmLibrary={(ids) => addEntries(ids, chooser.method)}
          onBack={() => setChooser((c) => ({ ...c, phase: c.phase === 'library' ? 'source' : 'method' }))}
          onClose={closeChooser}
        />
      )}
    </div>
  );
}

// ─── Two-phase add chooser overlay ───
//   method  → choose AI or on-device item
//   source  → take a photo / choose from library
//   library → multi-select grid
function OIAddChooser({ phase, method, remaining, dismissable, onPickMethod, onCamera, onGotoLibrary, onConfirmLibrary, onBack, onClose }) {
  const [picked, setPicked] = React.useState([]);
  React.useEffect(() => { if (phase !== 'library') setPicked([]); }, [phase]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const methodLabel = method === 'ai' ? 'EXTRACT BY AI' : 'EXTRACT BY ITEM';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
      <div onClick={dismissable ? onClose : undefined} style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,21,0.45)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, background: T.color.canvas,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        maxHeight: '86%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -2px 24px rgba(26,24,21,0.14)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: T.color.tertiary, opacity: 0.5, margin: '12px auto 0' }} />

        {/* header row: back (after step 1) + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 4px' }}>
          {phase !== 'method' && (
            <button onClick={onBack} style={{ width: 32, height: 32, marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: T.color.primary }}>
              <IconChevronLeft size={18} strokeWidth={1.3} />
            </button>
          )}
          <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>
            {phase === 'method' ? 'ADD ANOTHER PHOTO' : methodLabel}
          </span>
        </div>

        {/* PHASE: method */}
        {phase === 'method' && (
          <div style={{ padding: '8px 24px 30px' }}>
            <div style={{ ...type.h3, color: T.color.primary, marginBottom: 4 }}>How should we read this photo?</div>
            <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginBottom: 18 }}>Pick a method for the photo you’re about to add.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'ai',   title: 'Extract by AI', icon: <IconSparkle size={22} strokeWidth={1.3} />, desc: 'Finds every piece in a full-outfit photo and fills in all the details.', meta: 'Best for full looks', feature: true },
                { id: 'item', title: 'Extract by item', icon: <IconDashedSquare size={22} strokeWidth={1.3} />, desc: 'One item on a plain background, cut out and read on-device.', meta: 'On-device · Free', badge: 'FREE' },
              ].map((o) => (
                <button key={o.id} onClick={() => onPickMethod(o.id)} style={{
                  display: 'flex', flexDirection: 'column', gap: 12, width: '100%', textAlign: 'left',
                  padding: 18, borderRadius: 2, cursor: 'pointer',
                  border: o.feature ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
                  background: o.feature ? T.color.accent : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: o.feature ? T.color.canvas : T.color.primary, display: 'flex' }}>{o.icon}</span>
                    {o.badge && <span style={{ ...type.ui, fontSize: 9, color: T.color.canvas, background: T.color.primary, padding: '4px 9px', borderRadius: 999 }}>{o.badge}</span>}
                    {o.feature && <span style={{ ...type.ui, fontSize: 9, color: T.color.canvas, border: '0.5px solid rgba(250,247,242,0.4)', padding: '4px 9px', borderRadius: 999 }}>AI</span>}
                  </div>
                  <div>
                    <div style={{ fontFamily: T.font.serif, fontSize: 18, color: o.feature ? T.color.canvas : T.color.primary }}>{o.title}</div>
                    <div style={{ ...type.caption, fontSize: 12, lineHeight: 1.45, color: o.feature ? 'rgba(250,247,242,0.7)' : T.color.secondary, marginTop: 5, textWrap: 'pretty' }}>{o.desc}</div>
                  </div>
                  <div style={{ ...type.ui, fontSize: 9, color: o.feature ? 'rgba(250,247,242,0.6)' : T.color.tertiary, paddingTop: 10, borderTop: `0.5px solid ${o.feature ? 'rgba(250,247,242,0.18)' : T.color.hairline}` }}>{o.meta}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PHASE: source */}
        {phase === 'source' && (
          <div style={{ padding: '8px 24px 30px' }}>
            <div style={{ ...type.h3, color: T.color.primary, marginBottom: 4 }}>Add a photo</div>
            <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginBottom: 18 }}>
              {method === 'ai' ? 'Choose a full-outfit photo to analyse.' : 'Choose a single-item photo on a plain background.'}
            </div>
            <SourcePicker compact onCamera={onCamera} onLibrary={onGotoLibrary} />
          </div>
        )}

        {/* PHASE: library (multi-select) */}
        {phase === 'library' && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ ...type.h3, color: T.color.primary }}>Choose from library</div>
              <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 4 }}>Select one or more photos.</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px', minHeight: 0 }}>
              {remaining.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', ...type.caption }}>No more photos to add.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {remaining.map((p, i) => {
                    const sel = picked.includes(p.id);
                    const order = picked.indexOf(p.id) + 1;
                    return (
                      <div key={p.id} onClick={() => toggle(p.id)} style={{ position: 'relative', aspectRatio: '4/5', cursor: 'pointer', overflow: 'hidden', background: T.color.elevated }}>
                        <Photo src={p.photo} label="" tone={i % 5} />
                        {sel && <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,21,0.3)' }} />}
                        <div style={{
                          position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 999,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: sel ? T.color.primary : 'rgba(26,24,21,0.35)',
                          border: sel ? 'none' : '1px solid rgba(250,247,242,0.7)',
                          color: T.color.canvas, ...type.ui, fontSize: 9,
                        }}>
                          {sel ? order : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 24px 26px', borderTop: `0.5px solid ${T.color.hairline}`, background: T.color.canvas }}>
              <PrimaryButton onClick={() => picked.length && onConfirmLibrary(picked)} disabled={picked.length === 0}>
                {picked.length === 0 ? 'SELECT PHOTOS' : `ADD ${picked.length} ${picked.length === 1 ? 'PHOTO' : 'PHOTOS'}`}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── One upload row — photo + method badge on the left, its own note on the right ───
function OIUploadRow({ entry, index, note, setNote, onRemove }) {
  const { set, method } = entry;
  const isAI = method === 'ai';
  return (
    <div style={{
      display: 'flex', gap: 14, padding: 12, marginBottom: 12,
      background: T.color.canvas, border: `0.5px solid ${T.color.hairlineStrong}`,
    }}>
      {/* photo */}
      <div style={{ position: 'relative', width: 96, height: 120, flexShrink: 0, overflow: 'hidden', background: T.color.elevated }}>
        <Photo src={set.photo} label="PHOTO" tone={index % 5} />
        <div style={{ position: 'absolute', top: 6, left: 6, ...type.ui, fontSize: 8, color: T.color.canvas, background: 'rgba(26,24,21,0.62)', padding: '3px 6px' }}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>
      {/* method + note for THIS photo */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span style={{
            ...type.ui, fontSize: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 999,
            background: isAI ? T.color.accent : 'transparent',
            color: isAI ? T.color.canvas : T.color.primary,
            border: isAI ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
          }}>
            {isAI ? <IconSparkle size={10} strokeWidth={1.6} /> : <IconDashedSquare size={10} strokeWidth={1.6} />}
            {isAI ? 'BY AI' : 'BY ITEM'}
          </span>
          <button onClick={onRemove} style={{ ...type.ui, fontSize: 9, color: T.color.error, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
            REMOVE
          </button>
        </div>
        <textarea
          value={note || ''}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isAI ? 'e.g. the jacket is vintage…' : 'e.g. brand, fit notes…'}
          style={{
            flex: 1, width: '100%', minHeight: 64, resize: 'none', boxSizing: 'border-box',
            padding: 12, background: T.color.elevated, border: `0.5px solid ${T.color.hairline}`,
            fontFamily: T.font.sans, fontSize: 14, lineHeight: 1.5, color: T.color.primary, outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── STEP 1 · Upload (vertical list: photo + method + per-photo note) ───
function OIUpload({ entries, canAdd, notes, setNote, onAdd, onRemove, onAnalyse }) {
  const n = entries.length;
  const aiCount = entries.filter((e) => e.method === 'ai').length;
  const itemCount = n - aiCount;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
        <div style={{ ...type.h1, fontSize: 30, color: T.color.primary, textWrap: 'pretty' }}>Your photos.</div>
        <div style={{ ...type.caption, marginTop: 10 }}>Add as many as you like — each one extracted by AI or as a single item.</div>
        <div style={{ height: 20 }} />

        {n === 0 ? (
          /* empty state */
          <div style={{ padding: '40px 24px', textAlign: 'center', border: `0.5px dashed ${T.color.hairlineStrong}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: T.color.tertiary, marginBottom: 14 }}>
              <IconPlus size={26} strokeWidth={1.3} />
            </div>
            <div style={{ ...type.h3, color: T.color.primary }}>No photos yet</div>
            <div style={{ ...type.caption, fontSize: 12, marginTop: 8 }}>Tap below to add your first photo.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>
                {n} {n === 1 ? 'PHOTO' : 'PHOTOS'}{aiCount > 0 && itemCount > 0 ? ` · ${aiCount} AI · ${itemCount} ITEM` : ''}
              </span>
            </div>
            {entries.map((e, i) => (
              <OIUploadRow
                key={e.libId} entry={e} index={i}
                note={notes[e.libId]} setNote={(v) => setNote(e.libId, v)}
                onRemove={() => onRemove(e.libId)}
              />
            ))}
          </>
        )}

        {/* add another photo — opens the two-phase chooser */}
        {canAdd && (
          <button onClick={onAdd} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%',
            padding: '18px 0', marginTop: n === 0 ? 14 : 0,
            background: 'transparent', border: `0.5px dashed ${T.color.hairlineStrong}`,
            cursor: 'pointer', color: T.color.primary, ...type.ui, fontSize: 9,
          }}>
            <IconPlus size={16} strokeWidth={1.5} /> ADD {n === 0 ? 'A' : 'ANOTHER'} PHOTO
          </button>
        )}

        <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 12 }}>
          Notes help label colours and brands more accurately.
        </div>
        <div style={{ height: 16 }} />
      </div>
      <div style={{ flexShrink: 0, padding: '14px 24px 28px', borderTop: `0.5px solid ${T.color.hairline}`, background: T.color.canvas }}>
        <PrimaryButton onClick={onAnalyse} disabled={n === 0}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <IconSparkle size={15} strokeWidth={1.5} /> {n === 0 ? 'ADD A PHOTO TO START' : `ANALYSE ${n} ${n === 1 ? 'PHOTO' : 'PHOTOS'}`}
          </span>
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── STEP 2 · Processing (scans through each photo) ───
function OIProcessing({ entries }) {
  const [dots, setDots] = React.useState(1);
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => { const i = setInterval(() => setDots((d) => (d % 3) + 1), 420); return () => clearInterval(i); }, []);
  React.useEffect(() => {
    if (entries.length <= 1) return;
    const i = setInterval(() => setIdx((v) => Math.min(v + 1, entries.length - 1)), 1000);
    return () => clearInterval(i);
  }, [entries.length]);

  const current = entries[idx] || entries[0];
  const isAI = current && current.method === 'ai';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px 28px', minHeight: 0 }}>
      {/* photo with scanning sweep */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden', background: T.color.elevated, flexShrink: 0 }}>
        <Photo key={current.libId} src={current.set.photo} label="ANALYSING" tone={idx % 5} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,21,0.18)' }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2, background: 'rgba(250,247,242,0.9)',
          boxShadow: '0 0 18px 4px rgba(250,247,242,0.5)',
          animation: 'oiScan 2.2s cubic-bezier(0.45,0,0.55,1) infinite',
        }} />
        <style>{`@keyframes oiScan { 0% { top: 4%; } 50% { top: 94%; } 100% { top: 4%; } }
          @keyframes oiPulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }`}</style>
      </div>

      {/* thumbnail strip showing per-photo progress */}
      {entries.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {entries.map((e, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={e.libId} style={{ position: 'relative', flex: 1, aspectRatio: '4/5', overflow: 'hidden', background: T.color.elevated, opacity: done || active ? 1 : 0.4, transition: 'opacity 300ms' }}>
                <Photo src={e.set.photo} label="" tone={i % 5} />
                <div style={{ position: 'absolute', inset: 0, border: active ? `1.5px solid ${T.color.primary}` : 'none' }} />
                {done && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,21,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCheck size={16} color={T.color.canvas} strokeWidth={2} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ height: 24 }} />
      <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>PHOTO {Math.min(idx + 1, entries.length)} OF {entries.length} · {isAI ? 'BY AI' : 'ON-DEVICE'}</div>
      <div style={{ height: 10 }} />
      <div style={{ ...type.h2, color: T.color.primary }}>{isAI ? 'Finding every piece' : 'Removing background'}{'.'.repeat(dots)}</div>

      {/* skeleton placeholder rows */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, padding: 14,
            border: `0.5px solid ${T.color.hairline}`,
            animation: 'oiPulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
          }}>
            <div style={{ width: 56, height: 68, background: T.color.elevated, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 6 }}>
              <div style={{ width: '62%', height: 12, background: T.color.elevated }} />
              <div style={{ width: '40%', height: 9, background: T.color.elevated }} />
              <div style={{ width: '52%', height: 9, background: T.color.elevated }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STEP 3 · Review (items grouped by source photo) ───
function OIReview({ items, entries, onChange, onRemove, onConfirm }) {
  // Build display groups in photo order; only photos that still have items.
  let running = 0;
  const groups = entries
    .map((e) => ({ entry: e, items: items.filter((it) => it.srcId === e.libId) }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
        <div style={{ ...type.h1, fontSize: 28, color: T.color.primary }}>Review {items.length} {items.length === 1 ? 'item' : 'items'}.</div>
        <div style={{ ...type.caption, marginTop: 10 }}>From {groups.length} {groups.length === 1 ? 'photo' : 'photos'}. Tap any field to fix it. Remove anything that isn’t yours.</div>
        <div style={{ height: 20 }} />
        {items.length === 0 ? (
          <div style={{
            padding: '48px 24px', textAlign: 'center', border: `0.5px dashed ${T.color.hairlineStrong}`,
          }}>
            <div style={{ ...type.h3, color: T.color.primary }}>Nothing to save.</div>
            <div style={{ ...type.caption, marginTop: 8 }}>You removed every detected item.</div>
          </div>
        ) : (
          groups.map((g, gi) => {
            const isAI = g.entry.method === 'ai';
            return (
            <div key={g.entry.libId} style={{ marginBottom: 8 }}>
              {/* source-photo header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0 14px' }}>
                <div style={{ width: 40, height: 50, flexShrink: 0, overflow: 'hidden', background: T.color.elevated, border: `0.5px solid ${T.color.hairline}` }}>
                  <Photo src={g.entry.set.photo} label="" tone={gi % 5} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...type.ui, fontSize: 10, color: T.color.primary }}>PHOTO {String(gi + 1).padStart(2, '0')}</div>
                  <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 2 }}>{g.items.length} {g.items.length === 1 ? 'piece' : 'pieces'} found</div>
                </div>
                <span style={{
                  ...type.ui, fontSize: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 8px', borderRadius: 999, flexShrink: 0,
                  background: isAI ? T.color.accent : 'transparent',
                  color: isAI ? T.color.canvas : T.color.primary,
                  border: isAI ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
                }}>
                  {isAI ? <IconSparkle size={10} strokeWidth={1.6} /> : <IconDashedSquare size={10} strokeWidth={1.6} />}
                  {isAI ? 'BY AI' : 'BY ITEM'}
                </span>
              </div>
              {g.items.map((it) => {
                const idx = running++;
                return (
                  <OIItemCard key={it.id} item={it} index={idx} onChange={onChange} onRemove={() => onRemove(it.id)} />
                );
              })}
            </div>
          );})
        )}
        <div style={{ height: 16 }} />
      </div>
      <div style={{ flexShrink: 0, padding: '14px 24px 28px', borderTop: `0.5px solid ${T.color.hairline}`, background: T.color.canvas }}>
        <PrimaryButton onClick={onConfirm} disabled={items.length === 0}>
          {items.length === 0 ? 'NOTHING TO SAVE' : `CONFIRM ALL · ${items.length}`}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── STEP 4 · Done ───
function OIDone({ count, photoCount, onDone, onClose }) {
  const rise = () => ({});
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px 28px', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 999, background: T.color.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCheck size={32} color={T.color.canvas} strokeWidth={1.6} />
        </div>
        <div style={{ height: 28 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, ...rise(160) }}>ADDED TO WARDROBE</div>
        <div style={{ height: 12 }} />
        <div style={{ ...type.hero, fontSize: 56, color: T.color.primary, lineHeight: 1, whiteSpace: 'nowrap', ...rise(220) }}>
          {count} {count === 1 ? 'piece' : 'pieces'}
        </div>
        <div style={{ ...type.bodyL, color: T.color.secondary, marginTop: 18, maxWidth: 300, textWrap: 'pretty', ...rise(320) }}>
          Extracted from {photoCount} {photoCount === 1 ? 'photo' : 'photos'} and saved with their colours and brands. Find them anytime in your wardrobe.
        </div>
      </div>
      <div style={{ flexShrink: 0, ...rise(440) }}>
        <PrimaryButton onClick={onDone}>VIEW MY WARDROBE</PrimaryButton>
        <div style={{ height: 14 }} />
        <SecondaryButton onClick={onClose}>DONE</SecondaryButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  OutfitImportScreen, OIAddChooser, OIStepper, OIUpload, OIUploadRow, OIProcessing, OIReview, OIDone, OIItemCard,
  OIMeasureField, OITagEditor, oiMeasureGroup,
  OI_PHOTO_LIB, OI_STEPS,
});
