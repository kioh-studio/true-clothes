// icons.jsx — hairline stroke icons for TRUE CLOTHES
// 1.5pt stroke, monochromatic, no fills. Phosphor Light / Lucide Thin style.

const Icon = ({ children, size = 20, color = 'currentColor', strokeWidth = 1.5, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', ...style }}>
    {children}
  </svg>
);

const IconChevronLeft = (p) => <Icon {...p}><path d="M15 6l-6 6 6 6" /></Icon>;
const IconChevronRight = (p) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>;
const IconChevronDown = (p) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
const IconX = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M4 12l5 5 11-12" /></Icon>;

const IconBell = (p) => <Icon {...p}>
  <path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
  <path d="M10 21a2 2 0 004 0" />
</Icon>;

const IconHeart = ({ filled = false, ...p }) => <Icon {...p}>
  <path d="M12 21s-7-4.5-7-11a4 4 0 017-2.6A4 4 0 0119 10c0 6.5-7 11-7 11z" fill={filled ? 'currentColor' : 'none'} />
</Icon>;

const IconBookmark = ({ filled = false, ...p }) => <Icon {...p}>
  <path d="M6 3h12v18l-6-4-6 4V3z" fill={filled ? 'currentColor' : 'none'} />
</Icon>;

const IconCalendar = (p) => <Icon {...p}>
  <rect x="3.5" y="5" width="17" height="16" rx="1" />
  <path d="M3.5 10h17M8 3v4M16 3v4" />
</Icon>;

const IconShuffle = (p) => <Icon {...p}>
  <path d="M3 6h4l10 12h4M3 18h4l3-3.5M14 9l3-3h4M17 3l4 3-4 3M17 15l4 3-4 3" />
</Icon>;

const IconShare = (p) => <Icon {...p}>
  <path d="M12 3v13M7 8l5-5 5 5M5 14v6a1 1 0 001 1h12a1 1 0 001-1v-6" />
</Icon>;

const IconHome = (p) => <Icon {...p}>
  <path d="M3 11l9-8 9 8M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" />
</Icon>;

const IconHanger = (p) => <Icon {...p}>
  <path d="M12 7a2 2 0 11.5-3.9c1 .3 1.5 1.2 1.5 2.4v1.5L3 16h18L14 7.5" />
  <circle cx="12" cy="5" r="0.5" />
</Icon>;

const IconUser = (p) => <Icon {...p}>
  <circle cx="12" cy="8" r="4" />
  <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
</Icon>;

const IconSearch = (p) => <Icon {...p}>
  <circle cx="11" cy="11" r="7" />
  <path d="M16 16l5 5" />
</Icon>;

const IconSettings = (p) => <Icon {...p}>
  <path d="M4 6h12M4 12h7M4 18h10" />
  <circle cx="19" cy="6" r="2" />
  <circle cx="14" cy="12" r="2" />
  <circle cx="17" cy="18" r="2" />
</Icon>;

const IconPin = (p) => <Icon {...p}>
  <path d="M12 22s-7-7-7-13a7 7 0 0114 0c0 6-7 13-7 13z" />
  <circle cx="12" cy="9" r="2.5" />
</Icon>;

const IconCamera = (p) => <Icon {...p}>
  <rect x="3" y="6.5" width="18" height="13" rx="1.5" />
  <circle cx="12" cy="13" r="4" />
  <path d="M8 6.5l2-3h4l2 3" />
</Icon>;

const IconImage = (p) => <Icon {...p}>
  <rect x="3" y="4" width="18" height="16" rx="1" />
  <circle cx="9" cy="10" r="1.5" />
  <path d="M5 19l5-5 4 4 3-3 3 3" />
</Icon>;

const IconReceipt = (p) => <Icon {...p}>
  <path d="M5 3v18l3-2 2 2 2-2 2 2 2-2 3 2V3H5z" />
  <path d="M9 8h6M9 12h6M9 16h4" />
</Icon>;

const IconBook = (p) => <Icon {...p}>
  <path d="M4 5a2 2 0 012-2h6v17H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-6v17h6a2 2 0 012 2V5z" />
</Icon>;

const IconChat = (p) => <Icon {...p}>
  <path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H9l-5 4v-4a2 2 0 01-1-2V6z" />
</Icon>;

const IconLayers = (p) => <Icon {...p}>
  <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
</Icon>;

const IconSparkle = (p) => <Icon {...p}>
  <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
</Icon>;

const IconDot = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
</Icon>;

const IconRefresh = (p) => <Icon {...p}>
  <path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" />
</Icon>;

const IconFlash = (p) => <Icon {...p}>
  <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
</Icon>;

const IconDashedSquare = (p) => <Icon {...p} strokeDasharray="3 3">
  <rect x="4" y="4" width="16" height="16" rx="1" />
</Icon>;

const IconEdit = (p) => <Icon {...p}>
  <path d="M4 20h4l11-11-4-4L4 16v4zM14 6l4 4" />
</Icon>;

const IconAppleLogo = (p) => <Icon {...p}>
  <path d="M16 3c-.5 1.5-1.7 3-3.5 3-.2-1.7 1.3-3.5 3.5-3zM18 15c-.4 1-.9 2-1.8 3-1 1.1-2 2-3.2 2-1.4 0-1.8-.8-3-.8-1.3 0-1.7.8-3 .8-1.2 0-2.2-1-3.2-2.2C2 16.3 1 13 2.2 10.5c.9-1.7 2.5-2.8 4.3-2.8 1.3 0 2.5.9 3.3.9.8 0 2.2-1 4-.8 1 .04 2.6.4 3.7 2-3.2 1.8-2.6 6.5.5 5.2z" />
</Icon>;

const IconGoogleLogo = (p) => <Icon {...p}>
  <path d="M21 12.2c0-.7-.06-1.4-.17-2H12v3.8h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3c1.8-1.6 2.8-4.1 2.8-7.1z" />
  <path d="M12 21c2.6 0 4.7-.9 6.3-2.3l-3-2.4c-.8.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.5v2.5C5.1 18.7 8.3 21 12 21z" />
  <path d="M6.6 13.2A5.3 5.3 0 016.3 12c0-.4.1-.8.3-1.2V8.3H3.5A9 9 0 003 12c0 1.4.3 2.7 1 4l2.6-2.8z" />
  <path d="M12 6.4c1.4 0 2.7.5 3.6 1.4l2.7-2.7C16.7 3.6 14.5 3 12 3 8.3 3 5.1 5.3 3.5 8.3l3.1 2.5c.8-2.3 2.9-4 5.4-4z" />
</Icon>;

const IconLocation = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="9" />
  <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
</Icon>;

Object.assign(window, {
  Icon,
  IconChevronLeft, IconChevronRight, IconChevronDown, IconX, IconPlus, IconCheck,
  IconBell, IconHeart, IconBookmark, IconCalendar, IconShuffle, IconShare,
  IconHome, IconHanger, IconUser, IconSearch, IconSettings, IconPin,
  IconCamera, IconImage, IconReceipt, IconBook, IconChat, IconLayers,
  IconSparkle, IconDot, IconRefresh, IconFlash, IconDashedSquare, IconEdit,
  IconAppleLogo, IconGoogleLogo, IconLocation,
});
