import {boxPlotChartType} from '../src';

describe('chart type definitions', () => {
  it('box-plot uses renderer pattern', () => {
    // After renderer pattern migration, box-plot no longer uses
    // outputKind/createOutput/createSpec. It renders via BoxPlotPanelRenderer.
    expect(boxPlotChartType.renderer).toBeDefined();
    expect(boxPlotChartType.outputKind).toBeUndefined();
    expect(boxPlotChartType.createSpec).toBeUndefined();
    expect(boxPlotChartType.createOutput).toBeUndefined();
  });
});
