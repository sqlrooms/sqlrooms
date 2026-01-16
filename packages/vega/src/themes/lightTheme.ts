import {Config} from 'vega-lite';

const lightColor = '#000c';
const medColor = '#5553';
const markColor = 'rgb(59, 130, 246)';

export const lightTheme: Config = {
  background: 'transparent',

  arc: {fill: markColor},
  area: {fill: markColor},
  line: {stroke: markColor, strokeWidth: 2},
  rect: {fill: markColor},

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
