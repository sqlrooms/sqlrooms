import {MosaicLayout} from '@sqlrooms/layout';
import type {MosaicLayoutNode} from '@sqlrooms/layout-config';
import {ErrorBoundary} from '@sqlrooms/ui';
import {useCallback} from 'react';
import {useRoomStore} from '../store';

export function DashboardPanel() {
  const nodes = useRoomStore((s) => s.dashboard.nodes);
  const panels = useRoomStore((s) => s.dashboard.panels);
  const setNodes = useRoomStore((s) => s.dashboard.setNodes);

  const renderTile = useCallback(
    (panelId: string) => {
      const PanelComp = panels[panelId]?.component;
      if (!PanelComp) return <></>;
      return (
        <ErrorBoundary key={panelId}>
          <PanelComp />
        </ErrorBoundary>
      );
    },
    [panels],
  );

  const handleChange = useCallback(
    (newNodes: MosaicLayoutNode | null) => {
      setNodes(newNodes);
    },
    [setNodes],
  );

  return (
    <MosaicLayout
      renderTile={renderTile}
      value={nodes}
      onChange={handleChange}
      panels={panels}
    />
  );
}
