import {FC} from 'react';
import {LayoutNode} from '@sqlrooms/layout-config';
import {useGetPanel} from '../useGetPanel';

interface DockDragOverlayProps {
  activePanelId: string;
  activePanelNode: LayoutNode;
}

export const DockDragOverlay: FC<DockDragOverlayProps> = ({
  activePanelId,
  activePanelNode,
}) => {
  const panelInfo = useGetPanel(activePanelNode ?? activePanelId);
  const activePanelTitle = panelInfo?.title ?? activePanelId;

  const DragOverlayComponent = panelInfo?.dragOverlay;

  if (DragOverlayComponent) {
    return <DragOverlayComponent node={activePanelNode} />;
  }

  return (
    <div className="border-border bg-background text-foreground inline-flex items-center gap-1 border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
      <span>{activePanelTitle}</span>
    </div>
  );
};
