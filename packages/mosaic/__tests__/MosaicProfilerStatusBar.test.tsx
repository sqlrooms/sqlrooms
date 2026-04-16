import {jest} from '@jest/globals';
import {isValidElement, type ReactElement, type ReactNode} from 'react';
import {MosaicProfilerStatusBar} from '../src/profiler/MosaicProfilerStatusBar';
import type {UseMosaicProfilerReturn} from '../src/profiler/types';

function collectElements(node: ReactNode): ReactElement[] {
  if (node == null || typeof node === 'boolean') {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectElements);
  }

  if (!isValidElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children)];
}

function collectText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join('');
  }

  if (!isValidElement(node)) {
    return '';
  }

  return collectText(node.props.children);
}

function findButtonByLabel(
  element: ReactElement,
  label: string,
): ReactElement | undefined {
  return collectElements(element).find(
    (child) => child.props['aria-label'] === label,
  );
}

function createProfilerOverrides(
  overrides: Partial<
    Pick<
      UseMosaicProfilerReturn,
      | 'filteredRowCount'
      | 'hasFilters'
      | 'pagination'
      | 'reset'
      | 'setPagination'
      | 'sql'
      | 'totalRowCount'
    >
  > = {},
): Pick<
  UseMosaicProfilerReturn,
  | 'filteredRowCount'
  | 'hasFilters'
  | 'pagination'
  | 'reset'
  | 'setPagination'
  | 'sql'
  | 'totalRowCount'
> {
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

describe('MosaicProfilerStatusBar', () => {
  it('shows compact pagination and disables previous on the first page', () => {
    const profiler = createProfilerOverrides();
    const element = MosaicProfilerStatusBar({profiler});
    const previousButton = findButtonByLabel(element, 'Previous page');
    const nextButton = findButtonByLabel(element, 'Next page');

    expect(
      collectElements(element).some(
        (child) =>
          child.type === 'span' && collectText(child).includes('1 / 3'),
      ),
    ).toBe(true);
    expect(previousButton?.props.disabled).toBe(true);
    expect(nextButton?.props.disabled).toBe(false);
  });

  it('enables reset from the explicit filter flag instead of count comparison', () => {
    const profiler = createProfilerOverrides({
      filteredRowCount: 100,
      hasFilters: true,
      totalRowCount: 100,
    });
    const element = MosaicProfilerStatusBar({profiler});
    const resetButton = collectElements(element).find(
      (child) => collectText(child) === 'Reset',
    );

    expect(resetButton?.props.disabled).toBe(false);
  });

  it('disables next on the last page and updates page index when clicked', () => {
    const setPagination = jest.fn();
    const profiler = createProfilerOverrides({
      filteredRowCount: 26,
      pagination: {pageIndex: 1, pageSize: 13},
      setPagination,
    });
    const element = MosaicProfilerStatusBar({profiler});
    const previousButton = findButtonByLabel(element, 'Previous page');
    const nextButton = findButtonByLabel(element, 'Next page');

    expect(
      collectElements(element).some(
        (child) =>
          child.type === 'span' && collectText(child).includes('2 / 2'),
      ),
    ).toBe(true);
    expect(nextButton?.props.disabled).toBe(true);
    expect(previousButton?.props.disabled).toBe(false);

    previousButton?.props.onClick();
    expect(setPagination).toHaveBeenCalledTimes(1);
    const updatePagination = setPagination.mock.calls[0][0];
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
    const profiler = createProfilerOverrides({
      filteredRowCount: undefined,
      totalRowCount: undefined,
    });
    const element = MosaicProfilerStatusBar({profiler});
    const previousButton = findButtonByLabel(element, 'Previous page');
    const nextButton = findButtonByLabel(element, 'Next page');

    expect(
      collectElements(element).some(
        (child) => child.type === 'span' && collectText(child).includes('/'),
      ),
    ).toBe(false);
    expect(previousButton?.props.disabled).toBe(true);
    expect(nextButton?.props.disabled).toBe(true);
  });
});
