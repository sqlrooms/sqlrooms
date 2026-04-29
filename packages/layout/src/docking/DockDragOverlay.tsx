import {FC} from 'react';
import {createPortal} from 'react-dom';

const BADGE_OFFSET = 12;

interface DockDragOverlayProps {
  activePanelTitle: string | null;
  cursorPosition: {x: number; y: number} | null;
}

export const DockDragOverlay: FC<DockDragOverlayProps> = ({
  activePanelTitle,
  cursorPosition,
}) => {
  if (!activePanelTitle || !cursorPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="border-border/70 bg-background/95 text-muted-foreground pointer-events-none fixed z-[9999] inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap shadow-lg"
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
