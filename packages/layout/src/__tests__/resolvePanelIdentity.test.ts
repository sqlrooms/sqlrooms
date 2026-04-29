import {resolvePanelIdentity} from '../resolvePanelIdentity';
import {LayoutNode} from '@sqlrooms/layout-config';

describe('resolvePanelIdentity', () => {
  test('returns panel identity from string panel property', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'chart-1',
      panel: 'chart',
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'chart',
      meta: undefined,
    });
  });

  test('returns panel identity from object panel property', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'chart-1',
      panel: {key: 'chart', meta: {chartId: 'overview-users'}},
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'chart',
      meta: {chartId: 'overview-users'},
    });
  });

  test('returns id as panelId when panel property is missing', () => {
    const node: LayoutNode = {
      type: 'panel',
      id: 'chart-1',
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'chart-1',
      meta: undefined,
    });
  });

  test('works with dock nodes with string panel', () => {
    const node: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard',
      root: {type: 'panel', id: 'chart-1'},
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'dashboard',
      meta: undefined,
    });
  });

  test('works with dock nodes with object panel', () => {
    const node: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      panel: {key: 'dashboard', meta: {dashboardId: 'overview'}},
      root: {type: 'panel', id: 'chart-1'},
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'dashboard',
      meta: {dashboardId: 'overview'},
    });
  });

  test('returns id for dock nodes without panel property', () => {
    const node: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      root: {type: 'panel', id: 'chart-1'},
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'dashboard-1',
      meta: undefined,
    });
  });

  test('returns id for string node keys', () => {
    const node: LayoutNode = 'simple-panel';
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'simple-panel',
      meta: undefined,
    });
  });

  test('returns id for split nodes', () => {
    const node: LayoutNode = {
      type: 'split',
      id: 'split-1',
      direction: 'row',
      children: [],
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'split-1',
      meta: undefined,
    });
  });

  test('returns id for tabs nodes', () => {
    const node: LayoutNode = {
      type: 'tabs',
      id: 'tabs-1',
      activeTabIndex: 0,
      children: [],
    };
    expect(resolvePanelIdentity(node)).toEqual({
      panelId: 'tabs-1',
      meta: undefined,
    });
  });
});
