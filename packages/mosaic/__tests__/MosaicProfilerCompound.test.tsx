import {jest} from '@jest/globals';
import * as arrow from 'apache-arrow';
import {renderToStaticMarkup} from 'react-dom/server';
import {MosaicProfiler} from '../src/profiler/MosaicProfiler';
import type {UseMosaicProfilerReturn} from '../src/profiler/types';

function createProfiler(): UseMosaicProfilerReturn {
  return {
    columns: [],
    filteredRowCount: 25,
    hasFilters: true,
    isLoading: false,
    pageQuery: 'select * from earthquakes limit 25',
    pageTable: undefined,
    pagination: {pageIndex: 0, pageSize: 10},
    reset: jest.fn(),
    selection: {} as UseMosaicProfilerReturn['selection'],
    setPagination: jest.fn(),
    setSorting: jest.fn(),
    sorting: [],
    sql: 'select * from earthquakes',
    tableError: undefined,
    totalRowCount: 100,
  };
}

describe('MosaicProfiler compound API', () => {
  it('provides profiler context to compound subcomponents', () => {
    const markup = renderToStaticMarkup(
      <MosaicProfiler.Root profiler={createProfiler()}>
        <table>
          <MosaicProfiler.Rows />
        </table>
        <MosaicProfiler.StatusBar />
      </MosaicProfiler.Root>,
    );

    expect(markup).toContain('No rows');
    expect(markup).toContain('Reset');
    expect(markup).toContain('25');
    expect(markup).toContain('100 rows');
  });

  it('throws when a compound subcomponent renders without a provider', () => {
    expect(() => renderToStaticMarkup(<MosaicProfiler.StatusBar />)).toThrow(
      /MosaicProfiler compound components must be rendered inside/,
    );
  });

  it('renders header through the compound provider', () => {
    const profiler = createProfiler();
    profiler.columns = [
      {
        field: new arrow.Field('Magnitude', new arrow.Float64(), true),
        kind: 'histogram',
        name: 'Magnitude',
        summary: {
          filteredBins: [],
          filteredNullCount: 0,
          interactor: null,
          isLoading: false,
          kind: 'histogram',
          totalBins: [],
          totalNullCount: 0,
          valueType: 'number',
        },
      },
    ];

    const markup = renderToStaticMarkup(
      <table>
        <MosaicProfiler.Root profiler={profiler}>
          <MosaicProfiler.Header />
        </MosaicProfiler.Root>
      </table>,
    );

    expect(markup).toContain('Magnitude');
  });

  it('renders the compound table with profiler sizing defaults', () => {
    const profiler = createProfiler();
    profiler.columns = [
      {
        field: new arrow.Field('Magnitude', new arrow.Float64(), true),
        kind: 'histogram',
        name: 'Magnitude',
        summary: {
          filteredBins: [],
          filteredNullCount: 0,
          interactor: null,
          isLoading: false,
          kind: 'histogram',
          totalBins: [],
          totalNullCount: 0,
          valueType: 'number',
        },
      },
    ];

    const markup = renderToStaticMarkup(
      <MosaicProfiler.Root profiler={profiler}>
        <MosaicProfiler.Table>
          <tbody />
        </MosaicProfiler.Table>
      </MosaicProfiler.Root>,
    );

    expect(markup).toContain('table-fixed');
    expect(markup).toContain('min-w-full');
    expect(markup).toContain('width:180px');
  });
});
