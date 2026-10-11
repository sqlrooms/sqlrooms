import {ScatterPlotToolInput} from '../../src/charts/chart-types/scatter-plot/tool';
import {HeatmapToolInput} from '../../src/charts/chart-types/heatmap/tool';
import {CountPlotToolInput} from '../../src/charts/chart-types/count-plot/tool';

// LLMs frequently emit `null` for chart-settings fields they mean to omit. The
// settings fields are `.nullish()` (accept null AND undefined), so a null no
// longer rejects even though the tool inputs mark the settings `.required()`
// (which keeps them nullable-but-present). These tests lock that in.
describe('chart tool settings accept null (nullish)', () => {
  it('scatter-plot accepts a null optional field (size)', () => {
    const parsed = ScatterPlotToolInput.parse({
      tableName: 't',
      reasoning: 'r',
      settings: {x: 'a', y: 'b', size: null},
    });
    expect(parsed.settings.size).toBeNull();
    expect(parsed.settings.x).toBe('a');
  });

  it('heatmap accepts null for its axis fields', () => {
    const parsed = HeatmapToolInput.parse({
      tableName: 't',
      reasoning: 'r',
      settings: {x: 'a', y: null},
    });
    expect(parsed.settings.y).toBeNull();
  });

  it('count-plot tool input accepts null for its optional fields (valueField, leftMargin)', () => {
    // Regression: the count-plot AI input schema (`CountPlotToolSettings`) is
    // separate from the display schema, and previously left these `.optional()`,
    // so `{field, leftMargin: null}` was rejected at the tool boundary before any
    // normalization ran.
    const parsed = CountPlotToolInput.parse({
      tableName: 't',
      reasoning: 'r',
      settings: {field: 'category', valueField: null, leftMargin: null},
    });
    expect(parsed.settings.valueField).toBeNull();
    expect(parsed.settings.leftMargin).toBeNull();
    expect(parsed.settings.field).toBe('category');
  });
});
