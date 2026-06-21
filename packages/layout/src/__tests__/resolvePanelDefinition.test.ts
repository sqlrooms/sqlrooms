import {resolvePanelDefinition} from '../resolvePanelDefinition';
import {PanelDefinition, RoomPanelInfo} from '../types';

describe('resolvePanelDefinition', () => {
  test('returns static panel definition', () => {
    const definition: PanelDefinition = {
      title: 'Dashboard',
      icon: () => null,
    };
    const result = resolvePanelDefinition(definition, {
      panelId: 'dashboard',
    });
    expect(result).toEqual({title: 'Dashboard', icon: expect.any(Function)});
  });

  test('calls function definition with panelId', () => {
    const definition: PanelDefinition = (ctx) => ({
      title: `Panel ${ctx.panelId}`,
    });
    const result = resolvePanelDefinition(definition, {
      panelId: 'dashboard-1',
    });
    expect(result).toEqual({title: 'Panel dashboard-1'});
  });

  test('calls function definition with meta', () => {
    const definition: PanelDefinition = (ctx) => ({
      title: `Dashboard ${ctx.meta?.dashboardId ?? 'unknown'}`,
    });
    const result = resolvePanelDefinition(definition, {
      panelId: 'dashboard',
      meta: {dashboardId: 'overview'},
    });
    expect(result).toEqual({title: 'Dashboard overview'});
  });

  test('calls function definition without meta when undefined', () => {
    const definition: PanelDefinition = (ctx) => ({
      title: `Dashboard ${ctx.meta?.dashboardId ?? 'unknown'}`,
    });
    const result = resolvePanelDefinition(definition, {
      panelId: 'dashboard',
    });
    expect(result).toEqual({title: 'Dashboard unknown'});
  });

  test('passes layoutNode when provided', () => {
    const mockLayoutNode = {path: ['root', 'main']} as any;
    const definition: PanelDefinition = (ctx) => ({
      title: ctx.layoutNode ? 'Has context' : 'No context',
    });
    const result = resolvePanelDefinition(definition, {
      panelId: 'test',
      layoutNode: mockLayoutNode,
    });
    expect(result).toEqual({title: 'Has context'});
  });
});
