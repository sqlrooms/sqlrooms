import {Config} from 'vega-lite';

const lightColor = '#fffc';
const medColor = '#5555';
const markColor = 'hsl(221.2 83.2% 53.3%)';

export const darkTheme: Config = {
  background: 'transparent',

  arc: {fill: markColor},
  area: {fill: markColor},
  line: {stroke: markColor, strokeWidth: 2},
  point: {fill: markColor},
  bar: {fill: markColor},
  rect: {fill: markColor},
  circle: {fill: markColor},
  square: {fill: markColor},

  view: {
    stroke: medColor,
  },

  title: {
    color: lightColor,
    subtitleColor: lightColor,
  },

  style: {
    'guide-label': {
      fill: lightColor,
    },
    'guide-title': {
      fill: lightColor,
    },
  },

  axis: {
    domainColor: lightColor,
    gridColor: medColor,
    tickColor: lightColor,
  },
};
