import { defineTokens } from '@pandacss/dev';

export const colors = defineTokens.colors({
  current: { value: 'currentColor' },

  transparent: { value: 'rgb(0 0 0 / 0)' },

  gray: {
    5: { value: '#FDFDFD' },
    50: { value: '#F5F5F5' },
    100: { value: '#EEEEEE' },
    150: { value: '#E9E9E9' },
    200: { value: '#E2E2E2' },
    300: { value: '#C7C7C7' },
    400: { value: '#9B9B9B' },
    500: { value: '#767676' },
    600: { value: '#595959' },
    800: { value: '#353535' },
    900: { value: '#171717' },
  },

  cyan: {
    50: { value: '#F2FCFD' },
    200: { value: '#E7F9FB' },
    400: { value: '#27A6BA' },
    600: { value: '#176470' },
  },

  teal: {
    50: { value: '#F0FDFA' },
    100: { value: '#CCFBF1' },
    200: { value: '#99F6E4' },
    300: { value: '#5EEAD4' },
    400: { value: '#2DD4BF' },
    500: { value: '#14B8A6' },
    600: { value: '#0D9488' },
    700: { value: '#0F766E' },
    800: { value: '#115E59' },
    900: { value: '#134E4A' },
    950: { value: '#042F2E' },
  },

  red: {
    50: { value: '#FFF8F8' },
    200: { value: '#FFE5E5' },
    400: { value: '#E36469' },
    600: { value: '#DC3D43' },
    800: { value: '#CD2B31' },
    900: { value: '#7B1A1D' },
  },

  yellow: {
    800: { value: '#FFAA00' },
  },

  green: {
    800: { value: '#04B014' },
  },
});
