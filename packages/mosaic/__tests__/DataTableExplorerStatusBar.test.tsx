/**
 * @jest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import {jest} from '@jest/globals';
import {render, screen} from '@testing-library/react';
import {DataTableExplorerStatusBar} from '../src/data-table-explorer/DataTableExplorerStatusBar';
import type {UseDataTableExplorerReturn} from '../src/data-table-explorer/types';

type DataTableExplorerOverrides = Pick<
  UseDataTableExplorerReturn,
  | 'filteredRowCount'
  | 'hasFilters'
  | 'pagination'
  | 'reset'
  | 'setPagination'
  | 'sql'
  | 'totalRowCount'
>;

function createDataTableExplorerOverrides(
  overrides: Partial<DataTableExplorerOverrides> = {},
): DataTableExplorerOverrides {
  return {
    filteredRowCount: 25,
    hasFilters: false,
    pagination: {pageIndex: 0, pageSize: 10},
    reset: jest.fn(),
    setPagination: jest.fn(),
    sql: 'select * from earthquakes',
    totalRowCount: 100,
    ...overrides,
  };
}

describe('DataTableExplorerStatusBar', () => {
  it('shows compact pagination and disables previous on the first page', () => {
    const explorer = createDataTableExplorerOverrides();
    render(<DataTableExplorerStatusBar explorer={explorer} />);

    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('enables reset from the explicit filter flag instead of count comparison', () => {
    const explorer = createDataTableExplorerOverrides({
      filteredRowCount: 100,
      hasFilters: true,
      totalRowCount: 100,
    });
    render(<DataTableExplorerStatusBar explorer={explorer} />);

    expect(screen.getByText('Reset')).not.toBeDisabled();
  });

  it('disables next on the last page and updates page index when clicked', () => {
    const setPagination = jest.fn();
    const explorer = createDataTableExplorerOverrides({
      filteredRowCount: 26,
      pagination: {pageIndex: 1, pageSize: 13},
      setPagination,
    });
    render(<DataTableExplorerStatusBar explorer={explorer} />);

    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();

    screen.getByLabelText('Previous page').click();
    expect(setPagination).toHaveBeenCalledTimes(1);
    const updatePagination = setPagination.mock.calls[0]?.[0] as any;
    expect(
      updatePagination({
        pageIndex: 1,
        pageSize: 13,
      }),
    ).toEqual({
      pageIndex: 0,
      pageSize: 13,
    });
  });

  it('hides the page label and disables navigation while counts are unavailable', () => {
    const explorer = createDataTableExplorerOverrides({
      filteredRowCount: undefined,
      totalRowCount: undefined,
    });
    render(<DataTableExplorerStatusBar explorer={explorer} />);

    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });
});
