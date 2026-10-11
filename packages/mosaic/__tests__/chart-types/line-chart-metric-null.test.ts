import {validateLineChartSettings} from '../../src/charts/chart-types/line-chart/validation';
import {RequiredFieldsError} from '../../src/charts/chart-types/errors';

// `metric` is `.nullish()`, so an LLM may send `metric: null`. A destructuring
// default only covers `undefined`, so before the fix `null` slipped through:
// the `metric === 'aggregate'` required-Y guard was skipped and the validator
// returned `metric: null`, producing an empty series — a blank chart reported as
// success. These lock in the `?? 'aggregate'` normalization.
const dataTable = {
  table: {database: 'd', schema: 'main', table: 't'},
  columns: [
    {name: 'x_num', type: 'DOUBLE'},
    {name: 'val', type: 'DOUBLE'},
  ],
} as never;

describe('validateLineChartSettings — null metric normalization', () => {
  it('treats metric: null as aggregate and enforces the required Y-axis', () => {
    expect(() =>
      validateLineChartSettings({
        dataTable,
        settings: {x: 'x_num', metric: null, yFields: null} as never,
      }),
    ).toThrow(RequiredFieldsError);
  });

  it('resolves metric: null to aggregate when a numeric Y series is present', () => {
    const out = validateLineChartSettings({
      dataTable,
      settings: {
        x: 'x_num',
        metric: null,
        yFields: [{field: 'val', aggregate: 'sum'}],
      } as never,
    });
    expect(out.metric).toBe('aggregate');
    expect(out.yColumns).toHaveLength(1);
    expect(out.yColumns[0]!.field).toBe('val');
  });
});
