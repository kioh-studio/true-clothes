// outfit-import-showcase.jsx — static driver for the "Add to wardrobe → Extract by AI" flow.
// Mirrors OutfitImportScreen's layout but with fixed state so each step can live
// on its own artboard. Depends on outfit-import.jsx (OI* components) + theme/icons/data.

const OIS_NOOP = () => {};

// Build the "extracted items" exactly the way OutfitImportScreen.analyse() does,
// so the Review board shows real, populated cards.
function oisBuildItems(entries) {
  const built = [];
  entries.forEach((e) => {
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
  return built;
}

// Resolve a list of {libId, method} into full entries with their photo set.
function oisEntries(specs) {
  return specs
    .map((s) => ({ ...s, set: OI_PHOTO_LIB.find((p) => p.id === s.libId) }))
    .filter((e) => e.set);
}

// ── Static shell: header + stepper + a step body, plus an optional chooser overlay ──
function OIShell({ step, entries = [], notes = {}, items, chooser }) {
  const itemList = items || oisBuildItems(entries);
  const remaining = OI_PHOTO_LIB.filter((p) => !entries.some((e) => e.libId === p.id));

  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, paddingTop: STATUS_BAR_H,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${STATUS_BAR_H}px 16px 0`, height: STATUS_BAR_H + 52,
      }}>
        <button style={{
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.color.primary, opacity: step === 0 ? 1 : 0,
        }}>
          <IconChevronLeft size={20} strokeWidth={1.2} />
        </button>
        <span style={{ ...type.ui, fontSize: 11, color: T.color.primary }}>ADD TO WARDROBE</span>
        <button style={{
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
          entries={entries} canAdd={remaining.length > 0}
          notes={notes} setNote={OIS_NOOP}
          onAdd={OIS_NOOP} onRemove={OIS_NOOP} onAnalyse={OIS_NOOP}
        />
      )}
      {step === 1 && <OIProcessing entries={entries} />}
      {step === 2 && (
        <OIReview items={itemList} entries={entries} onChange={OIS_NOOP} onRemove={OIS_NOOP} onConfirm={OIS_NOOP} />
      )}
      {step === 3 && <OIDone count={itemList.length} photoCount={entries.length} onDone={OIS_NOOP} onClose={OIS_NOOP} />}

      {/* Optional add-chooser overlay (method / source / library) */}
      {chooser && (
        <OIAddChooser
          phase={chooser.phase} method={chooser.method} remaining={remaining}
          dismissable={entries.length > 0}
          onPickMethod={OIS_NOOP} onCamera={OIS_NOOP} onGotoLibrary={OIS_NOOP}
          onConfirmLibrary={OIS_NOOP} onBack={OIS_NOOP} onClose={OIS_NOOP}
        />
      )}
    </div>
  );
}

// ── Entry point from the wardrobe: the Add-item bottom sheet (method picker) ──
// Rendered open over a dimmed backdrop so it reads as the real entry screen.
function OISAddItemEntry() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: T.color.elevated }}>
      {/* faint wardrobe backdrop hint */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: STATUS_BAR_H + 8 }}>
        <div style={{ padding: '0 20px' }}>
          <div style={{ ...type.ui, fontSize: 11, color: T.color.tertiary }}>WARDROBE</div>
          <div style={{ ...type.h1, fontSize: 30, color: T.color.primary, marginTop: 6, opacity: 0.5 }}>Your pieces</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, padding: '20px 12px', opacity: 0.4 }}>
          {['jacket-harrington', 'tee-burgundy', 'jeans-blue', 'loafers-black', 'polo-olive', 'sweater-black'].map((n) => (
            <div key={n} style={{ aspectRatio: '4/5', background: T.color.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={`assets/items/${n}.png`} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      </div>
      <AddItemSheet open={true} onClose={OIS_NOOP} onAdded={OIS_NOOP} onOutfitImport={OIS_NOOP} />
    </div>
  );
}

Object.assign(window, { OIShell, OISAddItemEntry, oisEntries, oisBuildItems });
