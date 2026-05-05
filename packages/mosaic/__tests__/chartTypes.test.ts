import {boxPlotChartType, MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE} from '../src';

describe('chart type definitions', () => {
  it('creates box plots as dashboard panel outputs', () => {
    const output = boxPlotChartType.createOutput?.('earthquakes', {
      x: 'region',
      y: 'magnitude',
    });

    expect(boxPlotChartType.outputKind).toBe('dashboard-panel');
    expect(boxPlotChartType.createSpec).toBeUndefined();
    expect(output).toEqual({
      kind: 'dashboard-panel',
      type: MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE,
      source: {tableName: 'earthquakes'},
      config: {x: 'region', y: 'magnitude'},
    });
  });
});
