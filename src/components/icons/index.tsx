import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

const Icon = ({ size = 20, color = 'currentColor', strokeWidth = 1.5, style, children }: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => <Icon {...p}><Path d="M15 6l-6 6 6 6" /></Icon>;
export const IconChevronRight = (p: IconProps) => <Icon {...p}><Path d="M9 6l6 6-6 6" /></Icon>;
export const IconChevronDown = (p: IconProps) => <Icon {...p}><Path d="M6 9l6 6 6-6" /></Icon>;
export const IconX = (p: IconProps) => <Icon {...p}><Path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const IconPlus = (p: IconProps) => <Icon {...p}><Path d="M12 5v14M5 12h14" /></Icon>;
export const IconCheck = (p: IconProps) => <Icon {...p}><Path d="M4 12l5 5 11-12" /></Icon>;
export const IconMenu = (p: IconProps) => <Icon {...p}><Path d="M4 7h16M4 12h16M4 17h16" /></Icon>;

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
    <Path d="M10 21a2 2 0 004 0" />
  </Icon>
);

export const IconHeart = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.6A4 4 0 0119 10c0 6.5-7 11-7 11z"
      fill={filled ? (p.color || 'currentColor') : 'none'} />
  </Icon>
);

export const IconBookmark = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <Path d="M6 3h12v18l-6-4-6 4V3z" fill={filled ? (p.color || 'currentColor') : 'none'} />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3.5" y="5" width="17" height="16" rx="1" />
    <Path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);

export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3v13M7 8l5-5 5 5M5 14v6a1 1 0 001 1h12a1 1 0 001-1v-6" />
  </Icon>
);

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 11l9-8 9 8M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" />
  </Icon>
);

export const IconHanger = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 7a2 2 0 11.5-3.9c1 .3 1.5 1.2 1.5 2.4v1.5L3 16h18L14 7.5" />
    <Circle cx="12" cy="5" r="0.5" fill={p.color || 'currentColor'} />
  </Icon>
);

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M16 16l5 5" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 6h12M4 12h7M4 18h10" />
    <Circle cx="19" cy="6" r="2" />
    <Circle cx="14" cy="12" r="2" />
    <Circle cx="17" cy="18" r="2" />
  </Icon>
);

export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 22s-7-7-7-13a7 7 0 0114 0c0 6-7 13-7 13z" />
    <Circle cx="12" cy="9" r="2.5" />
  </Icon>
);

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3" y="6.5" width="18" height="13" rx="1.5" />
    <Circle cx="12" cy="13" r="4" />
    <Path d="M8 6.5l2-3h4l2 3" />
  </Icon>
);

export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3" y="4" width="18" height="16" rx="1" />
    <Circle cx="9" cy="10" r="1.5" />
    <Path d="M5 19l5-5 4 4 3-3 3 3" />
  </Icon>
);

export const IconReceipt = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 3v18l3-2 2 2 2-2 2 2 2-2 3 2V3H5z" />
    <Path d="M9 8h6M9 12h6M9 16h4" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 5a2 2 0 012-2h6v17H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-6v17h6a2 2 0 012 2V5z" />
  </Icon>
);

export const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H9l-5 4v-4a2 2 0 01-1-2V6z" />
  </Icon>
);

export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
  </Icon>
);

export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" />
  </Icon>
);

export const IconFlash = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </Icon>
);

export const IconDashedSquare = (p: IconProps) => (
  <Svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none"
    stroke={p.color || 'currentColor'} strokeWidth={p.strokeWidth || 1.5}
    strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3">
    <Rect x="4" y="4" width="16" height="16" rx="1" />
  </Svg>
);

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 20h4l11-11-4-4L4 16v4zM14 6l4 4" />
  </Icon>
);

export const IconAppleLogo = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M16 3c-.5 1.5-1.7 3-3.5 3-.2-1.7 1.3-3.5 3.5-3zM18 15c-.4 1-.9 2-1.8 3-1 1.1-2 2-3.2 2-1.4 0-1.8-.8-3-.8-1.3 0-1.7.8-3 .8-1.2 0-2.2-1-3.2-2.2C2 16.3 1 13 2.2 10.5c.9-1.7 2.5-2.8 4.3-2.8 1.3 0 2.5.9 3.3.9.8 0 2.2-1 4-.8 1 .04 2.6.4 3.7 2-3.2 1.8-2.6 6.5.5 5.2z" />
  </Icon>
);

export const IconShuffle = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M16 3h5v5M4 20l16-16M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </Icon>
);

export const IconDot = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="3" fill={p.color || 'currentColor'} stroke="none" />
  </Icon>
);

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 3" />
  </Icon>
);

export const IconThermometer = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
  </Icon>
);

export const IconGoogleLogo = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M21 12.2c0-.7-.06-1.4-.17-2H12v3.8h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3c1.8-1.6 2.8-4.1 2.8-7.1z" />
    <Path d="M12 21c2.6 0 4.7-.9 6.3-2.3l-3-2.4c-.8.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.5v2.5C5.1 18.7 8.3 21 12 21z" />
    <Path d="M6.6 13.2A5.3 5.3 0 016.3 12c0-.4.1-.8.3-1.2V8.3H3.5A9 9 0 003 12c0 1.4.3 2.7 1 4l2.6-2.8z" />
    <Path d="M12 6.4c1.4 0 2.7.5 3.6 1.4l2.7-2.7C16.7 3.6 14.5 3 12 3 8.3 3 5.1 5.3 3.5 8.3l3.1 2.5c.8-2.3 2.9-4 5.4-4z" />
  </Icon>
);
