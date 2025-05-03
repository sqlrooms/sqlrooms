import {theme} from '@kepler.gl/styles';

// SQL Room dark theme exported from sqlRoom preset, maybe there is a better way to do this
// but this is the only way I could find to make it work with tailwind
const sqlRoom = {
  background: '240 10% 3.9%',
  foreground: '0 0% 98%',
  card: '240 10% 3.9%',
  'card-foreground': '0 0% 98%',
  popover: '240 10% 3.9%',
  'popover-foreground': '0 0% 98%',
  primary: '0 0% 98%',
  'primary-foreground': '240 5.9% 10%',
  secondary: '240 3.7% 15.9%',
  'secondary-foreground': '0 0% 98%',
  muted: '240 3.7% 15.9%',
  'muted-foreground': '240 5% 64.9%',
  accent: '240 3.7% 15.9%',
  'accent-foreground': '0 0% 98%',
  destructive: '0 62.8% 30.6%',
  'destructive-foreground': '0 0% 98%',
  border: '240 3.7% 15.9%',
  input: '240 3.7% 15.9%',
  ring: '240 4.9% 83.9%',
  'chart-1': '220 70% 50%',
  'chart-2': '160 60% 45%',
  'chart-3': '30 80% 55%',
  'chart-4': '280 65% 60%',
  'chart-5': '340 75% 55%',
};
export const darkTheme = {
  ...theme,
  sidePanelBg: 'hsl(var(--background))',
  textColor: 'hsl(var(--foreground))',
  subtextColor: 'hsl(var(--muted-foreground))',
  labelColor: 'hsl(var(--muted-foreground))',
  panelBackground: 'hsl(var(--primary-foreground))',
  panelContentBackground: 'hsl(var(--background))',

  inputBgd: 'hsl(var(--input))',
  inputBgdHover: 'hsl(var(--input) / 0.8)',
  inputBgdActive: 'hsl(var(--input) / 0.8)',
  inputBorderHoverColor: 'hsl(var(--input) / 0.8)',
  inputBorderActiveColor: 'hsl(var(--input) / 0.8)',

  secondaryInputColor: 'hsl(var(--foreground))',
  secondaryInputBgd: 'hsl(var(--input))',
  secondaryInputBgdHover: 'hsl(var(--input) / 0.8)',
  secondaryInputBgdActive: 'hsl(var(--input) / 0.8)',
  secondaryInputBorderActiveColor: 'hsl(var(--input) / 0.8)',

  panelBackgroundHover: 'hsl(var(--muted))',
  panelHeaderIcon: 'hsl(var(--muted-foreground))',
  panelHeaderIconActive: 'hsl(var(--foreground))',
  panelHeaderIconHover: 'hsl(var(--foreground))',
  // button
  primaryBtnBgd: 'hsl(var(--chart-1))',
  primaryBtnBgdHover: 'hsl(var(--chart-1) / 0.8)',

  // dropdown
  dropdownListBgd: 'hsl(var(--primary-foreground))',
  dropdownListHighlightBg: 'hsl(var(--accent))',
  chickletBgd: 'hsl(var(--muted-foreground))',
  // slider
  sliderBarBgd: 'hsl(var(--secondary))',
};
