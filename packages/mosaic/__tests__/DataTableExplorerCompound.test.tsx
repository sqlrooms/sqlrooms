import {jest} from '@jest/globals';
import * as arrow from 'apache-arrow';
import {renderToStaticMarkup} from 'react-dom/server';
import {DataTableExplorer} from '../src/data-table-explorer/DataTableExplorer';
import type {UseDataTableExplorerReturn} from '../src/data-table-explorer/types';

function createDataTableExplorer(): UseDataTableExplorerReturn {
  return {
    columns: [],
    filteredRowCount: 25,
    hasFilters: true,
    isLoading: false,
    pageQuery: 'select * from earthquakes limit 25',
    pageTable: undefined,
    pagination: {pageIndex: 0, pageSize: 10},
    reset: jest.fn(),
    selection: {} as UseDataTableExplorerReturn['selection'],
    setPagination: jest.fn(),
    setSorting: jest.fn(),
    sorting: [],
    sql: 'select * from earthquakes',
    tableError: undefined,
    totalRowCount: 100,
  };
}

describe('DataTableExplorer compound API', () => {
  it('provides explorer context to compound subcomponents', () => {
    const markup = renderToStaticMarkup(
      <DataTableExplorer.Root explorer={createDataTableExplorer()}>
        <table>
          <DataTableExplorer.Rows />
        </table>
        <DataTableExplorer.StatusBar />
      </DataTableExplorer.Root>,
    );

    expect(markup).toContain('No rows');
    expect(markup).toContain('Reset');
    expect(markup).toContain('25');
    expect(markup).toContain('100 rows');
  });

  it('throws when a compound subcomponent renders without a provider', () => {
    expect(() => renderToStaticMarkup(<DataTableExplorer.StatusBar />)).toThrow(
      /DataTableExplorer compound components must be rendered inside/,
    );
  });

  it('renders header through the compound provider', () => {
    const explorer = createDataTableExplorer();
    explorer.columns = [
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
        <DataTableExplorer.Root explorer={explorer}>
          <DataTableExplorer.Header />
        </DataTableExplorer.Root>
      </table>,
    );

    expect(markup).toContain('Magnitude');
  });

  it('renders the compound table with explorer sizing defaults', () => {
    const explorer = createDataTableExplorer();
    explorer.columns = [
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
      <DataTableExplorer.Root explorer={explorer}>
        <DataTableExplorer.Table>
          <tbody />
        </DataTableExplorer.Table>
      </DataTableExplorer.Root>,
    );

    expect(markup).toContain('table-fixed');
    expect(markup).toContain('min-w-full');
    expect(markup).toContain('width:180px');
  });
});
