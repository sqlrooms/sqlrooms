import {extendTheme, ThemeConfig} from '@chakra-ui/react';
import {opacifyHex} from '@sqlrooms/utils';

export function createTheme(fonts: any) {
  const primary = '#162d3c';
  // const primary = '#0A2533';
  const primary2 = '#020c1a';

  const GRAYS = {
    900: '#0A1318',
    800: '#0E1D28',
    700: primary, // used for backgrounds
    // 800: '#0A1318',
    // 700: '#0E1D28',
    600: '#2a5674',
    500: '#3b738f',
    400: '#4f90a6',
    300: '#68abb8',
    200: '#85c4c9',
    100: '#a8dbd9',
  };

  return extendTheme({
    config: {
      initialColorMode: 'dark',
      useSystemColorMode: false,
      cssVarPrefix: 'fmc',
    } as ThemeConfig,
    colors: {
      link: 'red',
      logo: '#015A96',
      logoLight: '#0189e4',
      primary: primary,
      primary2: primary2,
      primaryTrBg: opacifyHex(primary, 0.9),
      backgroundColor: primary,
      gray: GRAYS,
      tooltipBgColor: opacifyHex(GRAYS[600], 0.95),
      textColor: '#fff',
      boxShadowColor: GRAYS[700],
      error: '#ce5e88',
      navBg: 'rgb(2, 12, 26)',
      white: '#fff',
    },
    fonts,
    components: {
      Button: {
        baseStyle: {
          fontWeight: '500', // Set the default font-weight for buttons
          borderRadius: 'sm',
        },
      },
    },
    radii: {
      // Set new default border-radius values
      sm: '1px',
      md: '2px',
      lg: '4px',
      // You can also add or modify other sizes if needed
    },
    backdropFilter: 'blur(5px) hue-rotate(90deg)',
  });
}
