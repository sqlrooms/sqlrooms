import {FC} from 'react';
import {createPortal} from 'react-dom';
import {LayoutNode} from '@sqlrooms/layout-config';
import {useGetPanel} from '../useGetPanel';

const BADGE_OFFSET = 12;

interface DockDragOverlayProps {
  activePanelId: string | null;
  activePanelNode: LayoutNode | null;
  cursorPosition: {x: number; y: number} | null;
}

export const DockDragOverlay: FC<DockDragOverlayProps> = ({
  activePanelId,
  activePanelNode,
  cursorPosition,
}) => {
  const panelInfo = useGetPanel(activePanelNode ?? activePanelId ?? '');
  const activePanelTitle = panelInfo?.title ?? activePanelId ?? '';

  if (!activePanelId || !cursorPosition || typeof document === 'undefined') {
    return null;
  }

  const DragOverlayComponent = panelInfo?.dragOverlay;

  if (DragOverlayComponent && activePanelNode) {
    return createPortal(
      <div
        className="pointer-events-none fixed z-[9999]"
        style={{
          left: cursorPosition.x + BADGE_OFFSET,
          top: cursorPosition.y + BADGE_OFFSET,
        }}
      >
        <DragOverlayComponent node={activePanelNode} />
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="border-border bg-background text-foreground pointer-events-none fixed z-[9999] inline-flex items-center gap-1 border px-2 py-1 text-xs whitespace-nowrap shadow-lg"
      style={{
        left: cursorPosition.x + BADGE_OFFSET,
        top: cursorPosition.y + BADGE_OFFSET,
      }}
    >
      <span>{activePanelTitle}</span>
    </div>,
    document.body,
  );
};
