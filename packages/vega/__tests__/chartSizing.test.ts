import {tableFromArrays} from 'apache-arrow';
import {getCategoryAwareVegaChartHeight} from '../src/chartSizing';

const horizontalBarSpec = {
  mark: 'bar',
  encoding: {
    x: {field: 'value', type: 'quantitative'},
    y: {field: 'category', type: 'nominal'},
  },
} as const;

function tableWithCategories(categories: string[]) {
  return tableFromArrays({
    category: categories,
    value: categories.map((_, index) => index),
  });
}

describe('getCategoryAwareVegaChartHeight', () => {
  it('sizes dense horizontal bar charts from distinct loaded categories', () => {
    const categories = Array.from({length: 30}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: horizontalBarSpec,
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe(708);
  });

  it('counts distinct category values rather than rows', () => {
    const categories = Array.from({length: 30}, (_, index) => `C${index % 15}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: horizontalBarSpec,
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe(378);
  });

  it('caps automatic height', () => {
    const categories = Array.from({length: 100}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: horizontalBarSpec,
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe(800);
  });

  it('supports shared encodings in layered horizontal bar specs', () => {
    const categories = Array.from({length: 12}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: {
          encoding: horizontalBarSpec.encoding,
          layer: [{mark: 'bar'}],
        },
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe(312);
  });

  it('supports count bars with inferred channel types', () => {
    const categories = Array.from({length: 12}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: {
          mark: 'bar',
          encoding: {
            x: {aggregate: 'count'},
            y: {field: 'category'},
          },
        },
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe(312);
  });

  it('keeps aspect-ratio sizing for small categorical charts', () => {
    const categories = Array.from({length: 11}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec: horizontalBarSpec,
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe('auto');
  });

  it.each([
    {
      mark: 'bar',
      encoding: {
        x: {field: 'category', type: 'nominal'},
        y: {field: 'value', type: 'quantitative'},
      },
    },
    {
      mark: 'point',
      encoding: {
        x: {field: 'value', type: 'quantitative'},
        y: {field: 'category', type: 'nominal'},
      },
    },
  ])('keeps aspect-ratio sizing for non-target chart shapes', (spec) => {
    const categories = Array.from({length: 30}, (_, index) => `C${index}`);

    expect(
      getCategoryAwareVegaChartHeight({
        spec,
        arrowTable: tableWithCategories(categories),
      }),
    ).toBe('auto');
  });
});
