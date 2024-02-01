export const specialColors = {
  inherit: 'inherit',
  current: 'currentColor',
  transparent: 'transparent',
};

export const basicColors = {
  black: '#000000',
  white: '#FFFFFF',
};

export const shadedColors = {
  gray: {
    5: '#F9F9F8',
    10: '#F1F1F0',
    20: '#E7E5E4',
    30: '#D6D3D1',
    40: '#A8A29E',
    50: '#FAFAFA',
    60: '#57534E',
    70: '#44403C',
    80: '#292524',
    90: '#1C1917',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
  brand: {
    5: '#FFFEF6',
    10: '#FFFDEF',
    20: '#FFF9D7',
    30: '#FFF5BC',
    40: '#FFE971',
    50: '#FCD242',
    55: '#E7BD2D',
    60: '#BA9812',
    70: '#7F6500',
    80: '#554100',
    90: '#3A2B00',
    100: '#211600',
  },
  red: {
    5: '#FFF9F8',
    10: '#FEEEED',
    20: '#FDDFDE',
    30: '#FCC8C6',
    40: '#F98B88',
    50: '#F66062',
    60: '#A83E3D',
    70: '#83302E',
    80: '#4F1C1C',
    90: '#361312',
    100: '#170807',
  },
  yellow: {
    5: '#FFFEF6',
    10: '#FFFDEF',
    20: '#FFF9D7',
    30: '#FFF5BC',
    40: '#FFE971',
    50: '#FCD242',
    55: '#E7BD2D',
    60: '#BA9812',
    70: '#7F6500',
    80: '#554100',
    90: '#3A2B00',
    100: '#211600',
  },
  blue: {
    5: '#f9fcfe',
    10: '#edf8fc',
    20: '#e1f2fa',
    30: '#cbe8f6',
    40: '#91cfec',
    50: '#58a8c3',
    60: '#407b8d',
    70: '#325f6c',
    80: '#1e3741',
    90: '#152529',
    100: '#090f10',
  },
  green: {
    5: '#f8fefc',
    10: '#ecfcf8',
    20: '#dffaf3',
    30: '#c8f7ea',
    40: '#8aeed2',
    50: '#4ecea6',
    60: '#41866e',
    70: '#2c745c',
    80: '#1b4337',
    90: '#122d23',
    100: '#08120e',
  },
  purple: {
    5: '#fbf9fe',
    10: '#f4eefd',
    20: '#eddffb',
    30: '#e0c8f9',
    40: '#bd8cf1',
    50: '#9656c9',
    60: '#6c3f91',
    70: '#553170',
    80: '#331c43',
    90: '#23132b',
    100: '#0f0811',
  },
  orange: {
    5: '#fffcf8',
    10: '#fef5ee',
    20: '#feede0',
    30: '#fde1ca',
    40: '#fabf8f',
    50: '#e9945b',
    60: '#a96d42',
    70: '#845433',
    80: '#50301e',
    90: '#362113',
    100: '#170d08',
  },
  teal: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
    950: '#042F2E',
  },
  pink: {
    500: '#EB4899',
  },
};

export const partialShadedColors = {
  alphagray: {
    10: '#0c0a091a',
    15: '#0c0a0926',
    30: '#0c0a094d',
    50: '#0c0a097f',
    60: '#0c0a0999',
    80: '#0c0a09cc',
  },
  alphawhite: {
    10: '#fafaf91a',
    15: '#fafaf926',
    30: '#fafaf94d',
    50: '#fafaf97f',
    60: '#fafaf999',
    80: '#fafaf9cc',
  },
};

export const designColors = {
  bg: {
    primary: '#F9F9F8',
    cardprimary: '#FFFFFF',
  },
  text: {
    primary: '#1C1917',
    secondary: '#78716C',
    disabled: '#A8A29E',
    darkprimary: '#FFF9F8',
  },
  post: {
    gray: shadedColors.gray[50],
    lightgray: shadedColors.gray[40],
    red: '#EA4335',
    blue: '#4285F4',
    brown: shadedColors.orange[60],
    green: '#00C75E',
    purple: '#9747FF',
    white: basicColors.white,
  },
  surface: {
    primary: '#F1F1F0',
    secondary: '#E7E5E4',
  },
  action: {
    red: {
      primary: '#F66062',
      primaryhover: '#E44E50',
    },
  },
  border: {
    primary: '#A8A29E',
    secondary: '#E7E5E4',
    tertiary: '#1C1917',
  },
  icon: {
    primary: '#1C1917',
    secondary: '#A8A29E',
    tertiary: '#D6D3D1',
  },
  error: {
    50: '#FFCECE',
    900: '#DC2626',
  },
  positive: {
    50: '#D7FBE3',
    900: '#16A34A',
  },
  hyperlink: {
    600: '#2563EB',
  },
};

type Color = keyof typeof shadedColors;
type Shade = keyof (typeof shadedColors)[keyof typeof shadedColors];

export type ColorShade = `${Color}-${Shade}` | keyof typeof basicColors;

export const color = (name: ColorShade) => {
  if (name in basicColors) {
    return basicColors[name as keyof typeof basicColors];
  } else {
    const [color, shade] = name.split('-') as [Color, Shade];
    return shadedColors[color][shade];
  }
};
