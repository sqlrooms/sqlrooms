import {buildColorScaleLegend, createColorScaleMapper} from '../src/scale';

describe('@sqlrooms/color-scales', () => {
  it('maps sequential auto domains to rgba arrays', () => {
    const mapper = createColorScaleMapper({
      colorScale: {
        field: 'magnitude',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: 'auto',
      },
      values: [1.5, 6.5],
    });

    expect(mapper(1.5)).toHaveLength(4);
    expect(mapper(1.5)).not.toEqual(mapper(6.5));
  });

  it('builds categorical legends with distinct items', () => {
    const legend = buildColorScaleLegend({
      colorScale: {
        field: 'status',
        type: 'categorical',
        scheme: 'Observable10',
      },
      values: ['low', 'high'],
      title: 'Status',
    });

    expect(legend?.type).toBe('categorical');
    if (legend?.type === 'categorical') {
      expect(legend.items).toHaveLength(2);
    }
  });

  it('builds stepped legends for quantile scales', () => {
    const legend = buildColorScaleLegend({
      colorScale: {
        field: 'magnitude',
        type: 'quantile',
        scheme: 'Blues',
        bins: 3,
      },
      values: [1.5, 6.5, 4.2],
      title: 'Magnitude',
    });

    expect(legend?.type).toBe('stepped');
    if (legend?.type === 'stepped') {
      expect(legend.items).toHaveLength(3);
    }
  });
});
