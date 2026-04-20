/**
 * @jest-environment jsdom
 */
import {renderHook} from '@testing-library/react';
import {useGetPanel} from '../useGetPanel';
import {LayoutNode} from '@sqlrooms/layout-config';

// Mock the store
jest.mock('../LayoutSlice', () => ({
  useStoreWithLayout: (selector: any) => {
    const mockState = {
      layout: {
        panels: {
          dashboard: {title: 'Dashboard', icon: () => null},
          chart: (ctx: any) => ({
            title: `Chart ${ctx.meta?.chartId ?? 'unknown'}`,
          }),
          'data-sources': {title: 'Data Sources'},
        },
      },
    };
    return selector(mockState);
  },
}));

describe('useGetPanel', () => {
  test('resolves panel by string key', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'p1',
      panel: 'dashboard',
    };
    const {result} = renderHook(() => useGetPanel(node));
    expect(result.current).toEqual({
      title: 'Dashboard',
      icon: expect.any(Function),
    });
  });

  test('resolves panel by object key with meta', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'p1',
      panel: {key: 'chart', meta: {chartId: 'overview-users'}},
    };
    const {result} = renderHook(() => useGetPanel(node));
    expect(result.current).toEqual({
      title: 'Chart overview-users',
    });
  });

  test('resolves panel using node id when panel property missing', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'data-sources',
    };
    const {result} = renderHook(() => useGetPanel(node));
    expect(result.current).toEqual({
      title: 'Data Sources',
    });
  });

  test('returns null when panel not found in registry', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'p1',
      panel: 'nonexistent',
    };
    const {result} = renderHook(() => useGetPanel(node));
    expect(result.current).toBeNull();
  });

  test('works with string node keys', () => {
    const node: LayoutNode = 'dashboard';
    const {result} = renderHook(() => useGetPanel(node));
    expect(result.current).toEqual({
      title: 'Dashboard',
      icon: expect.any(Function),
    });
  });
});
