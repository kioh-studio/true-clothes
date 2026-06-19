// theme.jsx — Design tokens and base components for TRUE CLOTHES
// Tokens here map 1:1 to a React Native theme.ts later.

const T = {
  color: {
    canvas: '#FAF7F2',
    elevated: '#F2EDE4',
    overlay: 'rgba(26, 24, 21, 0.04)',
    hairline: '#E5DFD3',
    hairlineStrong: '#D4CEC0',
    primary: '#1A1815',
    secondary: '#6B665C',
    tertiary: '#8C8579',
    accent: '#2C2A26',
    muted: '#D9D2C5',
    success: '#4A6147',
    warning: '#A0763D',
    error: '#8B3A30',
    info: '#4A5D6B',
    sheetDim: 'rgba(26, 24, 21, 0.45)',
  },
  font: {
    // serif for display, sans for body/UI
    serif: '"Cormorant Garamond", "Tiempos Display", "Playfair Display", Georgia, serif',
    sans: '"Inter", "Söhne", -apple-system, "Helvetica Neue", sans-serif',
  },
  // Spacing scale (4pt base)
  s: (n) => n * 4,
};

// Typography utility
const type = {
  hero:   { fontFamily: T.font.serif, fontSize: 56, fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.02em' },
  h1:     { fontFamily: T.font.serif, fontSize: 36, fontWeight: 300, lineHeight: 1.1,  letterSpacing: '-0.01em' },
  h2:     { fontFamily: T.font.serif, fontSize: 28, fontWeight: 400, lineHeight: 1.15 },
  h3:     { fontFamily: T.font.serif, fontSize: 20, fontWeight: 400, lineHeight: 1.2 },
  bodyL:  { fontFamily: T.font.sans,  fontSize: 17, fontWeight: 400, lineHeight: 1.5 },
  body:   { fontFamily: T.font.sans,  fontSize: 15, fontWeight: 400, lineHeight: 1.55 },
  caption:{ fontFamily: T.font.sans,  fontSize: 13, fontWeight: 400, lineHeight: 1.4, color: T.color.secondary },
  ui:     { fontFamily: T.font.sans,  fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.15em' },
  micro:  { fontFamily: T.font.sans,  fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.18em' },
};

// ─── Primary CTA — sharp corners, charcoal fill ───
function PrimaryButton({ children, onClick, disabled = false, style = {}, fullWidth = true }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        ...type.ui,
        display: 'block',
        width: fullWidth ? '100%' : 'auto',
        height: 56,
        padding: '0 32px',
        border: 'none',
        borderRadius: 0,
        background: T.color.accent,
        color: T.color.canvas,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : (pressed ? 0.85 : 1),
        transition: 'opacity 200ms ease-out',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ─── Secondary CTA — outlined ───
function SecondaryButton({ children, onClick, disabled = false, style = {}, fullWidth = true, icon = null }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        ...type.ui,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: fullWidth ? '100%' : 'auto',
        height: 56,
        padding: '0 32px',
        border: `1px solid ${T.color.primary}`,
        borderRadius: 0,
        background: 'transparent',
        color: T.color.primary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ─── Tertiary text link ───
function TextLink({ children, onClick, style = {}, color = T.color.primary, arrow = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...type.ui,
        background: 'transparent',
        border: 'none',
        padding: 0,
        color,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 4,
        textDecorationThickness: '0.5px',
        ...style,
      }}>
      {children}{arrow && ' →'}
    </button>
  );
}

// ─── Underline input field ───
function Field({ label, value, onChange, placeholder = '', type: t = 'text', suffix = null, error = null, helper = null, autoFocus = false, onFocus, onBlur, inputMode }) {
  const [focused, setFocused] = React.useState(false);
  const showLabel = focused || (value !== '' && value !== undefined && value !== null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 64 }}>
        <div style={{
          position: 'absolute', left: 0, top: showLabel ? 0 : 24,
          ...type.ui, fontSize: 10,
          color: error ? T.color.error : T.color.tertiary,
          transition: 'top 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms',
          opacity: showLabel ? 1 : 0.6,
          pointerEvents: 'none',
        }}>{label}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'baseline' }}>
          <input
            type={t}
            value={value || ''}
            inputMode={inputMode}
            autoFocus={autoFocus}
            placeholder={focused ? placeholder : ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
            onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
            style={{
              flex: 1,
              height: 36,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: T.font.sans,
              fontSize: 17,
              fontWeight: 400,
              color: T.color.primary,
              padding: '0 0 8px 0',
            }}
          />
          {suffix && (
            <div style={{ ...type.ui, color: T.color.tertiary, paddingBottom: 12, marginLeft: 8 }}>{suffix}</div>
          )}
        </div>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: focused || error ? 1 : 0.5,
          background: error ? T.color.error : (focused ? T.color.primary : T.color.hairline),
          transition: 'background 220ms, height 120ms',
        }} />
      </div>
      {(helper || error) && (
        <div style={{
          ...type.caption,
          fontSize: 12,
          color: error ? T.color.error : T.color.tertiary,
          marginTop: 8,
        }}>{error || helper}</div>
      )}
    </div>
  );
}

// ─── Pill / chip ───
function Tag({ children, selected = false, onClick, style = {}, size = 'md' }) {
  const padV = size === 'sm' ? 6 : 8;
  const padH = size === 'sm' ? 12 : 14;
  return (
    <button
      onClick={onClick}
      style={{
        ...type.ui,
        fontSize: size === 'sm' ? 9 : 10,
        padding: `${padV}px ${padH}px`,
        border: selected ? 'none' : `0.5px solid ${T.color.hairlineStrong}`,
        background: selected ? T.color.primary : 'transparent',
        color: selected ? T.color.canvas : T.color.primary,
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 200ms ease-out',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ─── Segmented control (unit toggle) ───
function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      border: `0.5px solid ${T.color.hairlineStrong}`,
      borderRadius: 999,
      padding: 2,
      background: 'transparent',
    }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button key={opt}
            onClick={() => onChange(opt)}
            style={{
              ...type.ui, fontSize: 9,
              padding: '6px 12px',
              border: 'none',
              borderRadius: 999,
              background: active ? T.color.primary : 'transparent',
              color: active ? T.color.canvas : T.color.tertiary,
              cursor: 'pointer',
              transition: 'all 200ms',
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Hairline divider ───
function Divider({ vertical = false, style = {} }) {
  return (
    <div style={{
      background: T.color.hairline,
      ...(vertical
        ? { width: 0.5, height: '100%' }
        : { width: '100%', height: 0.5 }),
      ...style,
    }} />
  );
}

// ─── Bottom sheet ───
function BottomSheet({ open, onClose, children, height = 'auto', maxHeight = '90%' }) {
  const [mounted, setMounted] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 450);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: T.color.sheetDim,
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: T.color.canvas,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        maxHeight, height,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -2px 24px rgba(26, 24, 21, 0.06)',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: T.color.tertiary, opacity: 0.5,
          margin: '12px auto 0',
        }} />
        {children}
      </div>
    </div>
  );
}

// ─── Editorial placeholder image (used as fallback when img fails) ───
function PhotoFallback({ label = 'IMAGE', ratio, tone = 0, children }) {
  const tones = [
    ['#E8E0D0', '#D4CABA'],
    ['#D9D2C5', '#C8BFAE'],
    ['#EFE9DC', '#DDD4C0'],
    ['#C9C0B0', '#B5AB99'],
    ['#E2D9C7', '#D0C6B0'],
  ];
  const [a, b] = tones[tone % tones.length];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...type.micro, color: T.color.tertiary,
      position: 'relative',
    }}>
      <span style={{ background: T.color.canvas, padding: '4px 8px' }}>{label}</span>
      {children}
    </div>
  );
}

// ─── Photo with fallback ───
function Photo({ src, alt = '', label = 'IMAGE', tone = 0, style = {}, children, fit = 'cover' }) {
  const [errored, setErrored] = React.useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: fit, display: 'block', filter: 'saturate(0.85) contrast(0.97)' }}
        />
      ) : (
        <PhotoFallback label={label} tone={tone} />
      )}
      {children}
    </div>
  );
}

// ─── Source picker — two rows: take a photo / choose from library ───
// Shared by both add flows (Extract by item & Extract by AI).
function SourcePicker({ onCamera, onLibrary, compact = false }) {
  const rows = [
    { id: 'cam', title: 'Take a photo', desc: 'Use your camera', icon: <IconCamera size={22} strokeWidth={1.3} />, on: onCamera },
    { id: 'lib', title: 'Choose from library', desc: 'Pick existing photos', icon: <IconImage size={22} strokeWidth={1.3} />, on: onLibrary },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <button key={r.id} onClick={r.on} style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
          padding: compact ? '13px 16px' : '16px 18px',
          background: 'transparent', border: `0.5px solid ${T.color.hairlineStrong}`, borderRadius: 2, cursor: 'pointer',
        }}>
          <span style={{ color: T.color.primary, flexShrink: 0, display: 'flex' }}>{r.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: T.font.serif, fontSize: 16, color: T.color.primary }}>{r.title}</span>
            <span style={{ display: 'block', ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 2 }}>{r.desc}</span>
          </span>
          <IconChevronRight size={14} strokeWidth={1.4} color={T.color.tertiary} />
        </button>
      ))}
    </div>
  );
}

Object.assign(window, {
  T, type, PrimaryButton, SecondaryButton, TextLink,
  Field, Tag, Segmented, Divider, BottomSheet, Photo, PhotoFallback, SourcePicker,
});
