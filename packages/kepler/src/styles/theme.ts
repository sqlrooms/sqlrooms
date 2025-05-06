import {theme} from '@kepler.gl/styles';

// SQL Room dark theme exported from sqlRoom preset, maybe there is a better way to do this
// but this is the only way I could find to make it work with tailwind

export const darkTheme = {
  ...theme,
  sidePanelBg: 'hsl(var(--background))',
  bottomWidgetBgd: 'hsl(var(--background))',
  textColor: 'hsl(var(--foreground))',

  subtextColor: 'hsl(var(--muted-foreground))',
  labelColor: 'hsl(var(--muted-foreground))',
  panelBackground: 'hsl(var(--primary-foreground))',
  panelBorderColor: 'hsl(var(--muted-foreground) / 0.2)',
  panelContentBackground: 'hsl(var(--background))',

  inputBgd: 'hsl(var(--input))',
  inputBgdHover: 'hsl(var(--input) / 0.8)',
  inputBgdActive: 'hsl(var(--input) / 0.8)',
  inputBorderHoverColor: 'hsl(var(--input) / 0.8)',
  inputBorderActiveColor: 'hsl(var(--input) / 0.8)',

  switchTrackBgdActive: 'hsl(var(--input))',
  switchTrackBgd: 'hsl(var(--input))',
  switchBtnBgdActive: 'hsl(var(--foreground))',
  switchBtnBgd: 'hsl(var(--muted-foreground) / 0.2)',
  secondarySwitchTrackBgd: 'hsl(var(--input))',
  secondarySwitchBtnBgd: 'hsl(var(--muted-foreground) / 0.2)',

  secondaryInputColor: 'hsl(var(--foreground))',
  secondaryInputBgd: 'hsl(var(--input))',
  secondaryInputBgdHover: 'hsl(var(--input) / 0.8)',
  secondaryInputBgdActive: 'hsl(var(--input) / 0.8)',
  secondaryInputBorderActiveColor: 'hsl(var(--input) / 0.8)',
  secondaryInputBorderColor: 'hsl(var(--input))',

  panelBackgroundHover: 'hsl(var(--muted))',
  panelHeaderIcon: 'hsl(var(--muted-foreground))',
  panelHeaderIconActive: 'hsl(var(--foreground))',
  panelHeaderIconHover: 'hsl(var(--foreground))',

  // button
  primaryBtnBgd: 'hsl(var(--chart-1))',
  primaryBtnBgdHover: 'hsl(var(--chart-1) / 0.8)',
  floatingBtnRadius: '4px',
  ctaBtnBgd: 'hsl(var(--chart-1))',
  ctaBtnBgdHover: 'hsl(var(--chart-1) / 0.8)',
  ctaBtnActBgd: 'hsl(var(--chart-1) / 0.8)',
  floatingBtnBgd: 'hsl(var(--primary-foreground))',
  floatingBtnBgdHover: 'hsl(var(--secondary))',
  floatingBtnColor: 'hsl(var(--foreground))',

  // dropdown
  dropdownListBgd: 'hsl(var(--primary-foreground))',
  dropdownListHighlightBg: 'hsl(var(--accent))',
  chickletBgd: 'hsl(var(--muted-foreground) / 0.4)',
  dropdownListBorderTop: 'hsl(var(--muted-foreground) / 0.2)',
  // slider
  sliderBarBgd: 'hsl(var(--secondary))',

  // chart
  histogramFillInRange: 'hsl(var(--chart-1))',

  // size
  bottomWidgetPaddingTop: 0,
  bottomWidgetPaddingRight: 0,
  bottomWidgetPaddingBottom: 0,
  bottomWidgetPaddingLeft: 0,
  panelHeaderBorderRadius: '4px',
};
