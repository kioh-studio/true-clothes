import { TextStyle } from 'react-native';

export const T = {
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
    season: {
      spring: '#8B7355',
      summer: '#6B7B8B',
      autumn: '#A0673A',
      winter: '#3A4A5C',
    },
    offlineBg: '#EDE8DF',
    extractionIndicator: '#4A5D6B',
  },
  font: {
    serif: 'CormorantGaramond_400Regular' as const,
    serifLight: 'CormorantGaramond_300Light' as const,
    sans: 'Inter_400Regular' as const,
    sansMedium: 'Inter_500Medium' as const,
  },
  s: (n: number) => n * 4,
};

export const type = {
  hero: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 56,
    fontWeight: '300' as const,
    lineHeight: 59,
    letterSpacing: -1,
  } as TextStyle,
  h1: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 36,
    fontWeight: '300' as const,
    lineHeight: 40,
    letterSpacing: -0.4,
  } as TextStyle,
  h2: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 28,
    fontWeight: '400' as const,
    lineHeight: 32,
  } as TextStyle,
  h3: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 24,
  } as TextStyle,
  bodyL: {
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 26,
  } as TextStyle,
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 23,
  } as TextStyle,
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: T.color.secondary,
  } as TextStyle,
  ui: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  } as TextStyle,
  micro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    fontWeight: '400' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.8,
  } as TextStyle,
};
