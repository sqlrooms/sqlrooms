import * as vg from '@uwdata/vgplot';
import {brush} from '@/lib/mosaic';

const backgroundColor = '#f5d9a6';
const foregroundColor = '#e67f5f';

export const createMagPlot = () =>
  vg.plot(
    vg.rectY(vg.from('earthquakes'), {
      x: vg.bin('Magnitude', {maxbins: 25}),
      y: vg.count(),
      fill: backgroundColor,
      inset: 0.5,
    }),
    vg.rectY(vg.from('earthquakes', {filterBy: brush}), {
      x: vg.bin('Magnitude', {maxbins: 25}),
      y: vg.count(),
      fill: foregroundColor,
      inset: 0.5,
    }),
    vg.intervalX({as: brush}),
    vg.xLabel('Magnitude (Richter)'),
    vg.yLabel(null),
    vg.yAxis(null),
    vg.height(180),
    vg.width(380),
    vg.margins({left: 0, right: 10, top: 10, bottom: 30}),
  );

export const createDepthPlot = () =>
  vg.plot(
    vg.raster(vg.from('earthquakes', {filterBy: brush}), {
      x: 'Magnitude',
      y: 'Depth',
      fill: 'density',
      bandwidth: 0,
      pixelSize: 3,
    }),
    vg.colorScale('sqrt'),
    vg.colorScheme('ylorrd'),
    vg.intervalXY({as: brush}),
    vg.yReverse(true),
    vg.xLabel('Magnitude'),
    vg.yLabel('Depth (km)'),
    vg.height(250),
    vg.width(380),
    vg.margins({left: 24, right: 10, top: 15, bottom: 30}),
  );

export const createTimePlot = () =>
  vg.plot(
    vg.rectY(vg.from('earthquakes'), {
      x: vg.bin('DateTime', {maxbins: 40}),
      y: vg.count(),
      fill: backgroundColor,
      inset: 0.5,
    }),
    vg.rectY(vg.from('earthquakes', {filterBy: brush}), {
      x: vg.bin('DateTime', {maxbins: 40}),
      y: vg.count(),
      fill: foregroundColor,
      inset: 0.5,
    }),
    vg.intervalX({as: brush}),
    vg.xLabel('Year'),
    vg.yLabel(null),
    vg.yAxis(null),
    vg.height(180),
    vg.width(380),
    vg.margins({left: -15, right: 15, top: 10, bottom: 30}),
  );
