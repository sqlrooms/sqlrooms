import {ColorLegendConfig, ColorScaleConfig} from '../src/config';

describe('color scale schemas', () => {
  it('validates sequential scales', () => {
    expect(
      ColorScaleConfig.parse({
        field: 'Magnitude',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: [0, 8],
      }),
    ).toBeTruthy();
  });

  it('validates legend config', () => {
    expect(ColorLegendConfig.parse({title: 'Magnitude'})).toEqual({
      title: 'Magnitude',
    });
  });
});
