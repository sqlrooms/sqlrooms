import {extendTheme, ThemeConfig} from '@chakra-ui/react';

function createTheme(fonts: Record<string, string>): ThemeConfig {
  const GRAYS = {
    // https://gka.github.io/palettes/#/10|s|2e353e|ffffe0,ff005e,93003a|1|1
    900: '#020c16',
    800: '#1a2129',
    700: '#2e353e', // primary
    600: '#434a54',
    500: '#59616b',
    400: '#717882',
    300: '#89909b',
    200: '#a1a9b4',
    100: '#bbc3ce',
    '000': '#d5dde9',
  };

  const primary = GRAYS[700];
  const primary2 = '#1a1a1a';

  return extendTheme({
    config: {
      initialColorMode: 'dark',
      useSystemColorMode: false,
      cssVarPrefix: 'fmc',
    } as ThemeConfig,
    colors: {
      link: 'red',
      logo: '#015A96',
      logoLight: '#fff',
      primary,
      primary2,
      primaryTrBg: primary,
      backgroundColor: primary,
      gray: GRAYS,
      tooltipBgColor: GRAYS[600],
      legendBg: GRAYS[600],
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
    fontSizes: {
      xs: '0.75rem',
      sm: '0.775rem',
      md: '0.9rem',
      lg: '1rem',
      xl: '1.15rem',
      '2xl': '1.4rem',
      '3xl': '1.775rem',
      '4xl': '2.15rem',
      '5xl': '2.9rem',
      '6xl': '3.65rem',
      '7xl': '4.4rem',
      '8xl': '5.9rem',
      '9xl': '7.9rem',
    },
  });
}

const theme = createTheme({});
export default theme;
