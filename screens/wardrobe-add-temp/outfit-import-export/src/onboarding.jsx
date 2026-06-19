// onboarding.jsx — All 9 onboarding screens for TRUE CLOTHES
// SplashScreen, AccountScreen, OTPScreen, BasicsScreen, LocationScreen,
// MeasurementsScreen, StylesScreen, ColorsScreen, CompleteScreen

const SCREEN_PAD_H = 24;
const STATUS_BAR_H = 50; // iOS safe area height we reserve at the top

// ─── shared screen wrapper ───
function ScreenShell({ children, scroll = true, bottomPadding = 24, topPadding = 56 }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column',
      overflow: scroll ? 'auto' : 'hidden',
    }}>
      <div style={{ height: STATUS_BAR_H + topPadding, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: `0 ${SCREEN_PAD_H}px ${bottomPadding}px`, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─── tiny top nav (back chevron + optional right action) ───
function TopBar({ onBack, rightLabel, onRight, rightColor }) {
  return (
    <div style={{
      position: 'absolute', top: STATUS_BAR_H, left: 0, right: 0, height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `0 ${SCREEN_PAD_H - 8}px`, zIndex: 10,
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: T.color.primary,
        }}>
          <IconChevronLeft size={20} strokeWidth={1.2} />
        </button>
      ) : <div style={{ width: 44 }} />}
      {rightLabel ? (
        <button onClick={onRight} style={{
          ...type.ui, padding: '0 12px', height: 44,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: rightColor || T.color.tertiary,
        }}>{rightLabel}</button>
      ) : <div style={{ width: 44 }} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.1 SPLASH / WELCOME
// ═════════════════════════════════════════════════════════════
function SplashScreen({ onBegin, onSignIn }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Top: editorial image, 55% */}
      <div style={{
        flex: '0 0 55%', position: 'relative',
        opacity: show ? 1 : 0, transition: 'opacity 600ms ease-out',
      }}>
        <Photo src={PHOTOS.detail_1} label="EDITORIAL DETAIL" tone={3}
          style={{ filter: 'grayscale(1) contrast(1.05)' }} />
      </div>
      {/* Bottom: brand */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: `48px ${SCREEN_PAD_H + 16}px 32px`,
      }}>
        <div style={{
          ...type.hero, fontSize: 44,
          color: T.color.primary,
          opacity: show ? 1 : 0,
          transform: show ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 600ms 200ms ease-out, transform 600ms 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}>TRUE CLOTHES</div>
        <div style={{
          ...type.body, color: T.color.secondary,
          textAlign: 'center', marginTop: 14,
          opacity: show ? 1 : 0, transition: 'opacity 600ms 500ms ease-out',
        }}>A more considered way to dress.</div>
        <div style={{ flex: 1, minHeight: 24, maxHeight: 96 }} />
        <div style={{
          width: '100%',
          opacity: show ? 1 : 0, transition: 'opacity 600ms 700ms ease-out',
        }}>
          <PrimaryButton onClick={onBegin}>BEGIN</PrimaryButton>
          <div style={{ height: 16 }} />
          <div style={{ textAlign: 'center' }}>
            <TextLink onClick={onSignIn} color={T.color.primary}>I already have an account →</TextLink>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.2 ACCOUNT SETUP
// ═════════════════════════════════════════════════════════════
function AccountScreen({ onBack, onContinue }) {
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const phoneValid = phone.replace(/\D/g, '').length >= 8;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 32 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>Let's begin.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>We'll keep this minimal. Two fields.</div>
        <div style={{ height: 48 }} />

        <Field label="EMAIL" value={email} onChange={setEmail} placeholder="you@example.com"
          helper="Optional — but useful for recovery." inputMode="email" />
        <div style={{ height: 24 }} />
        <Field label="PHONE" value={phone} onChange={setPhone} placeholder="+84 123 456 789"
          helper="We'll send a one-time code to verify." inputMode="tel" />

        <div style={{ height: 64 }} />
        <PrimaryButton onClick={() => phoneValid && onContinue({ email, phone })} disabled={!phoneValid}>
          CONTINUE
        </PrimaryButton>

        <div style={{ height: 24 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Divider style={{ flex: 1 }} />
          <div style={{ ...type.ui, color: T.color.tertiary }}>OR</div>
          <Divider style={{ flex: 1 }} />
        </div>
        <div style={{ height: 24 }} />

        <SecondaryButton icon={<IconAppleLogo size={18} />} onClick={() => onContinue({ provider: 'apple' })}>
          CONTINUE WITH APPLE
        </SecondaryButton>
        <div style={{ height: 12 }} />
        <SecondaryButton icon={<IconGoogleLogo size={18} />} onClick={() => onContinue({ provider: 'google' })}>
          CONTINUE WITH GOOGLE
        </SecondaryButton>

        <div style={{ flex: 1, minHeight: 32 }} />
        <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, textAlign: 'center' }}>
          By continuing, you agree to our <u>Terms</u> and <u>Privacy Policy</u>.
        </div>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.3 OTP VERIFICATION
// ═════════════════════════════════════════════════════════════
function OTPScreen({ onBack, onContinue, phone = '+84 123 456 789' }) {
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = React.useState(45);
  const inputsRef = React.useRef([]);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onDigit = (i, v) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputsRef.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const filled = digits.every((d) => d !== '');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 32 }} />
        <div style={{ ...type.h2, color: T.color.primary }}>Enter the code.</div>
        <div style={{ ...type.caption, marginTop: 8 }}>
          Sent to {phone}. <u style={{ color: T.color.primary, cursor: 'pointer' }}>Edit number</u>
        </div>
        <div style={{ height: 48 }} />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          {digits.map((d, i) => (
            <div key={i} style={{
              flex: 1, height: 56, position: 'relative',
            }}>
              <input
                ref={(el) => (inputsRef.current[i] = el)}
                value={d}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                inputMode="numeric"
                style={{
                  width: '100%', height: '100%',
                  border: 'none', outline: 'none', background: 'transparent',
                  textAlign: 'center',
                  fontFamily: T.font.sans, fontSize: 24, fontWeight: 400,
                  color: T.color.primary,
                }}
              />
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                height: d ? 1 : 0.5,
                background: d ? T.color.primary : T.color.hairline,
                transition: 'background 200ms',
              }} />
            </div>
          ))}
        </div>

        <div style={{ height: 48 }} />
        <div style={{ textAlign: 'center', ...type.ui, fontSize: 11, color: countdown > 0 ? T.color.tertiary : T.color.primary, cursor: countdown > 0 ? 'default' : 'pointer' }}
             onClick={() => countdown === 0 && setCountdown(45)}>
          {countdown > 0
            ? `Resend code in 0:${String(countdown).padStart(2, '0')}`
            : <u>Resend code</u>}
        </div>

        <div style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton onClick={() => filled && onContinue()} disabled={!filled}>VERIFY</PrimaryButton>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.4 BASIC DETAILS — Age / Gender
// ═════════════════════════════════════════════════════════════
function BasicsScreen({ onBack, onSkip, onContinue }) {
  const [dd, setDd] = React.useState('');
  const [mm, setMm] = React.useState('');
  const [yyyy, setYyyy] = React.useState('');
  const [gender, setGender] = React.useState(null);
  const genders = ['WOMAN', 'MAN', 'NON-BINARY', 'PREFER NOT TO SAY'];

  const DateField = ({ value, onChange, placeholder, max }) => (
    <input
      value={value}
      maxLength={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      inputMode="numeric"
      style={{
        flex: 1, height: 40,
        border: 'none', outline: 'none', background: 'transparent',
        borderBottom: `0.5px solid ${value ? T.color.primary : T.color.hairline}`,
        textAlign: 'center',
        fontFamily: T.font.sans, fontSize: 17, color: T.color.primary,
        transition: 'border-color 200ms',
      }}
    />
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} rightLabel="SKIP" onRight={onSkip} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 32 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>About you.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>This helps us tailor suggestions. You can change it anytime.</div>
        <div style={{ height: 48 }} />

        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 }}>DATE OF BIRTH</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DateField value={dd} onChange={setDd} placeholder="DD" max={2} />
          <span style={{ color: T.color.hairlineStrong }}>/</span>
          <DateField value={mm} onChange={setMm} placeholder="MM" max={2} />
          <span style={{ color: T.color.hairlineStrong }}>/</span>
          <DateField value={yyyy} onChange={setYyyy} placeholder="YYYY" max={4} />
        </div>
        <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 8 }}>
          We use this for age-appropriate suggestions only.
        </div>

        <div style={{ height: 40 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 }}>GENDER</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {genders.map((g) => (
            <Tag key={g} selected={gender === g} onClick={() => setGender(g)}>{g}</Tag>
          ))}
        </div>
        <div style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 8 }}>
          Affects body type silhouette options. Doesn't restrict style choices.
        </div>

        <div style={{ flex: 1, minHeight: 48 }} />
        <PrimaryButton onClick={onContinue}>CONTINUE</PrimaryButton>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.5 LOCATION
// ═════════════════════════════════════════════════════════════
function LocationScreen({ onBack, onSkip, onContinue }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} rightLabel="SKIP" onRight={onSkip} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 32 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>Where are you?</div>
        <div style={{ ...type.caption, marginTop: 12 }}>We'll use this for weather-aware suggestions.</div>
        <div style={{ height: 48 }} />

        <div style={{
          border: `0.5px solid ${T.color.hairlineStrong}`,
          borderRadius: 2,
          padding: 24,
        }}>
          <IconPin size={20} strokeWidth={1.2} color={T.color.primary} />
          <div style={{ height: 12 }} />
          <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>DETECTED LOCATION</div>
          <div style={{ height: 4 }} />
          <div style={{ ...type.h3, color: T.color.primary }}>Ho Chi Minh City, Vietnam</div>
          <div style={{ height: 8 }} />
          <div style={{ ...type.caption, color: T.color.secondary }}>27°C, partly cloudy</div>
          <div style={{ height: 20 }} />
          <TextLink color={T.color.primary}>Edit location</TextLink>
        </div>

        <div style={{ height: 32 }} />
        <div style={{ ...type.caption, color: T.color.secondary, textAlign: 'center' }}>Or set manually:</div>
        <div style={{ height: 16 }} />
        <Field label="" value="" onChange={() => {}} placeholder="Search city or region…" />

        <div style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton onClick={onContinue}>USE THIS LOCATION</PrimaryButton>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.6 MEASUREMENTS
// ═════════════════════════════════════════════════════════════
function MeasurementsScreen({ onBack, onSkip, onContinue }) {
  const [height, setHeight] = React.useState('');
  const [weight, setWeight] = React.useState('');
  const [heightUnit, setHeightUnit] = React.useState('CM');
  const [weightUnit, setWeightUnit] = React.useState('KG');
  const [chest, setChest] = React.useState('');
  const [waist, setWaist] = React.useState('');
  const [hips, setHips] = React.useState('');
  const [inseam, setInseam] = React.useState('');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} rightLabel="SKIP" onRight={onSkip} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 32 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>Your measurements.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>
          We use these to recommend items that fit your frame. Required fields are minimal.
        </div>
        <div style={{ height: 40 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary }}>REQUIRED</div>
        </div>

        <div style={{ position: 'relative' }}>
          <Field label="HEIGHT" value={height} onChange={setHeight} placeholder="—" suffix={heightUnit.toLowerCase()} inputMode="numeric" />
          <div style={{ position: 'absolute', right: 0, top: 16 }}>
            <Segmented options={['CM', 'IN']} value={heightUnit} onChange={setHeightUnit} />
          </div>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ position: 'relative' }}>
          <Field label="WEIGHT" value={weight} onChange={setWeight} placeholder="—" suffix={weightUnit.toLowerCase()} inputMode="numeric" />
          <div style={{ position: 'absolute', right: 0, top: 16 }}>
            <Segmented options={['KG', 'LB']} value={weightUnit} onChange={setWeightUnit} />
          </div>
        </div>

        <div style={{ height: 40 }} />
        <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 16 }}>
          OPTIONAL — IMPROVES ACCURACY
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="CHEST / BUST" value={chest} onChange={setChest} placeholder="— cm" inputMode="numeric" />
          <Field label="WAIST" value={waist} onChange={setWaist} placeholder="— cm" inputMode="numeric" />
          <Field label="HIPS" value={hips} onChange={setHips} placeholder="— cm" inputMode="numeric" />
          <Field label="INSEAM" value={inseam} onChange={setInseam} placeholder="— cm" inputMode="numeric" />
        </div>

        <div style={{ height: 32 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink color={T.color.primary} arrow>Estimate with AI photo capture</TextLink>
          <div style={{ ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 8 }}>
            Take a photo in fitted clothing. We'll estimate measurements with on-device AI.
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton onClick={onContinue}>CONTINUE</PrimaryButton>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.7 STYLE SELECTION
// ═════════════════════════════════════════════════════════════
function StylesScreen({ onBack, onSkip, onContinue }) {
  const [selected, setSelected] = React.useState([]);
  const toggle = (id) => setSelected((s) =>
    s.includes(id) ? s.filter(x => x !== id) : [...s, id]
  );
  const count = selected.length;

  // Related styles surface after 1+ selection
  const RELATED_MAP = {
    oldmoney: ['preppy', 'smartcasual'],
    streetwear: ['athleisure', 'y2k'],
    minimalist: ['smartcasual'],
    smartcasual: ['oldmoney', 'preppy'],
  };
  const related = selected.flatMap(id => RELATED_MAP[id] || []).filter(id => !selected.includes(id));
  const relatedUnique = [...new Set(related)];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} rightLabel={count > 0 ? `${count} SELECTED` : 'SKIP'} onRight={count > 0 ? null : onSkip} rightColor={count > 0 ? T.color.primary : T.color.tertiary} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 24 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>Find your styles.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>Select what speaks to you. We'll learn as you go.</div>
        <div style={{ height: 24 }} />

        {relatedUnique.length > 0 && (
          <div style={{ marginBottom: 24, marginLeft: -24, marginRight: -24 }}>
            <div style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, padding: '0 24px', marginBottom: 12 }}>
              BECAUSE YOU LIKE {STYLES.find(s => s.id === selected[0])?.name.toUpperCase()}
            </div>
            <div style={{
              display: 'flex', gap: 12, overflowX: 'auto', padding: '0 24px',
              scrollbarWidth: 'none',
            }}>
              {relatedUnique.slice(0, 4).map(id => {
                const s = STYLES.find(x => x.id === id);
                return (
                  <StyleCard key={s.id} style={s} small selected={selected.includes(s.id)} onClick={() => toggle(s.id)} />
                );
              })}
            </div>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          {STYLES.map((s) => (
            <StyleCard key={s.id} style={s} selected={selected.includes(s.id)} onClick={() => toggle(s.id)} />
          ))}
        </div>
        <div style={{ height: 24 }} />
        <PrimaryButton onClick={() => count > 0 && onContinue()} disabled={count === 0}>
          {count > 0 ? `CONTINUE (${count} SELECTED)` : 'SELECT AT LEAST ONE'}
        </PrimaryButton>
      </ScreenShell>
    </div>
  );
}

function StyleCard({ style: s, selected, onClick, small = false }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer',
      width: small ? 130 : '100%',
      aspectRatio: '3/4',
      flexShrink: 0,
      borderRadius: 2, overflow: 'hidden',
      transition: 'transform 200ms ease-out',
    }}>
      <Photo src={s.img} label={s.name} tone={selected ? 0 : 2}
        style={{ filter: 'grayscale(0.85) contrast(1.02)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '45%',
        background: 'linear-gradient(to top, rgba(26, 24, 21, 0.7), transparent)',
      }} />
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <div style={{
          fontFamily: T.font.serif, fontSize: small ? 15 : 18, fontWeight: 400,
          color: T.color.canvas,
        }}>{s.name}</div>
        <div style={{ ...type.ui, fontSize: 9, color: 'rgba(242, 237, 228, 0.8)', marginTop: 4 }}>
          {s.desc}
        </div>
      </div>
      {selected && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            border: `2px solid ${T.color.canvas}`,
          }} />
          <div style={{
            position: 'absolute', top: 10, right: 10,
            width: 24, height: 24, borderRadius: 999,
            background: T.color.canvas,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCheck size={14} color={T.color.primary} strokeWidth={1.8} />
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.8 COLOR PREFERENCES
// ═════════════════════════════════════════════════════════════
function ColorsScreen({ onBack, onSkip, onContinue, onDetect, detectedSeason }) {
  const [selected, setSelected] = React.useState([]);
  const toggle = (name) => setSelected(s =>
    s.includes(name) ? s.filter(x => x !== name) : [...s, name]
  );
  const seasonData = detectedSeason ? (window.PC_SEASONS || {})[detectedSeason] : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TopBar onBack={onBack} rightLabel={selected.length > 0 ? `${selected.length} SELECTED` : 'SKIP'} onRight={selected.length > 0 ? null : onSkip} rightColor={selected.length > 0 ? T.color.primary : T.color.tertiary} />
      <ScreenShell topPadding={56}>
        <div style={{ height: 24 }} />
        <div style={{ ...type.h1, color: T.color.primary }}>Your palette.</div>
        <div style={{ ...type.caption, marginTop: 12 }}>Which tones do you reach for?</div>
        <div style={{ height: 24 }} />

        {/* ── Personal color detection entry ── */}
        {seasonData ? (
          <button onClick={onDetect} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            padding: 16, marginBottom: 8, cursor: 'pointer',
            background: T.color.elevated, border: `0.5px solid ${T.color.hairlineStrong}`,
          }}>
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {seasonData.palette.slice(0, 4).map((hex, i) => (
                <div key={i} style={{ width: 14, height: 36, background: hex }} />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>YOUR SEASON</div>
              <div style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: 400, color: T.color.primary, marginTop: 2 }}>
                {seasonData.name} <span style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>· {seasonData.undertone}</span>
              </div>
            </div>
            <span style={{ ...type.ui, fontSize: 9, color: T.color.primary, textDecoration: 'underline', textUnderlineOffset: 3 }}>RETAKE</span>
          </button>
        ) : (
          <button onClick={onDetect} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            padding: 18, marginBottom: 8, cursor: 'pointer',
            background: T.color.accent, border: 'none',
          }}>
            <IconSparkle size={20} strokeWidth={1.2} color={T.color.canvas} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font.serif, fontSize: 19, fontWeight: 400, color: T.color.canvas }}>
                Detect my personal color
              </div>
              <div style={{ ...type.ui, fontSize: 9, color: 'rgba(250,247,242,0.65)', marginTop: 4 }}>
                5 QUICK QUESTIONS · FINDS YOUR SEASON
              </div>
            </div>
            <IconChevronRight size={18} strokeWidth={1.4} color={T.color.canvas} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <Divider style={{ flex: 1 }} />
          <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>OR PICK BY HAND</div>
          <Divider style={{ flex: 1 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {COLORS.map((c) => {
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
                      position: 'absolute', top: 8, right: 8,
                      width: 12, height: 12, borderRadius: 999,
                      background: isLight ? T.color.primary : T.color.canvas,
                    }} />
                  )}
                </div>
                <div style={{
                  fontFamily: T.font.serif, fontSize: 14, fontWeight: 400,
                  color: T.color.primary, textAlign: 'center', marginTop: 8,
                }}>{c.name}</div>
                <div style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, textAlign: 'center', marginTop: 4 }}>
                  {c.tag}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: 24 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onContinue} color={T.color.primary}>I'm open to anything — surprise me.</TextLink>
        </div>
        <div style={{ height: 24 }} />
        <PrimaryButton onClick={onContinue}>CONTINUE</PrimaryButton>
      </ScreenShell>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// §2.9 ONBOARDING COMPLETE
// ═════════════════════════════════════════════════════════════
function CompleteScreen({ onEnter, onAddItems }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      width: '100%', height: '100%', background: T.color.canvas,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: `80px ${SCREEN_PAD_H + 16}px 48px`,
      opacity: show ? 1 : 0, transition: 'opacity 600ms ease-out',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 200, height: 280, overflow: 'hidden' }}>
          <Photo src={PHOTOS.detail_2} label="DETAIL" tone={3}
            style={{ filter: 'grayscale(1) contrast(1.05)' }} />
        </div>
        <div style={{ height: 48 }} />
        <div style={{ ...type.h1, color: T.color.primary, textAlign: 'center' }}>All set.</div>
        <div style={{ ...type.bodyL, color: T.color.secondary, marginTop: 16, textAlign: 'center', maxWidth: 280 }}>
          Your feed is waiting.
        </div>
      </div>
      <div style={{ width: '100%' }}>
        <PrimaryButton onClick={onEnter}>ENTER</PrimaryButton>
        <div style={{ height: 24 }} />
        <div style={{ textAlign: 'center' }}>
          <TextLink onClick={onAddItems} color={T.color.primary} arrow>Add items to wardrobe first</TextLink>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  SplashScreen, AccountScreen, OTPScreen, BasicsScreen,
  LocationScreen, MeasurementsScreen, StylesScreen, ColorsScreen, CompleteScreen,
  StyleCard,
});
