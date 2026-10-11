/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import {SelectablePanelWrapper} from '../src/block-settings/SelectablePanelWrapper';
import type {BlockSettingsSliceState} from '../src/block-settings/BlockSettingsSlice';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createBlockSettingsStore() {
  return createStore<BlockSettingsSliceState>(() => ({
    blockSettings: {
      config: {},
      runtime: {
        isSettingsPanelOpen: false,
        settingsPanelOpenRequest: 0,
      },
      selectBlock: jest.fn(),
      requestOpenSettingsPanel: jest.fn(),
      requestCloseSettingsPanel: jest.fn(),
      setSettingsPanelOpen: jest.fn(),
      clearSelection: jest.fn(),
      isBlockSelected: jest.fn(() => false),
      clearSelectionIfBlockDeleted: jest.fn(),
    },
  }));
}

describe('SelectablePanelWrapper rendering markers', () => {
  it('identifies dashboard panels without marking other selectable blocks as panels', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const store = createBlockSettingsStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store as never}>
          <SelectablePanelWrapper
            dashboardId="dashboard-1"
            panelId="panel-1"
            panelType="chart"
            blockType="dashboard-panel"
          >
            <span data-testid="dashboard-panel" />
          </SelectablePanelWrapper>
          <SelectablePanelWrapper
            dashboardId="document-1"
            panelId="block-1"
            panelType="chart"
            blockType="standalone-block"
          >
            <span data-testid="standalone-block" />
          </SelectablePanelWrapper>
          <SelectablePanelWrapper
            dashboardId="dashboard-2"
            panelId="dashboard-2"
            panelType="dashboard"
            blockType="dashboard-block"
          >
            <span data-testid="dashboard-block" />
          </SelectablePanelWrapper>
        </RoomStateProvider>,
      );
    });

    const dashboardPanel = container.querySelector(
      '[data-testid="dashboard-panel"]',
    )?.parentElement;
    expect(dashboardPanel?.getAttribute('data-dashboard-id')).toBe(
      'dashboard-1',
    );
    expect(dashboardPanel?.getAttribute('data-dashboard-panel-id')).toBe(
      'panel-1',
    );

    const standaloneBlock = container.querySelector(
      '[data-testid="standalone-block"]',
    )?.parentElement;
    expect(standaloneBlock?.getAttribute('data-dashboard-id')).toBe(
      'document-1',
    );
    expect(standaloneBlock?.hasAttribute('data-dashboard-panel-id')).toBe(
      false,
    );

    const dashboardBlock = container.querySelector(
      '[data-testid="dashboard-block"]',
    )?.parentElement;
    expect(dashboardBlock?.getAttribute('data-dashboard-id')).toBe(
      'dashboard-2',
    );
    expect(dashboardBlock?.hasAttribute('data-dashboard-panel-id')).toBe(false);

    act(() => root.unmount());
  });
});
