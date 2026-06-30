import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizablePanelHandle,
  ScrollArea,
  cn,
} from '@sqlrooms/ui';
import type {Editor} from '@tiptap/react';
import type {FC, ReactNode} from 'react';
import {useCallback, useEffect, useRef} from 'react';
import {BlockSettingsPanel} from './BlockSettingsPanel';
import {useBlockSettingsStore} from './useBlockSettingsStore';

export type BlockSettingsPanelLayoutProps = {
  /** Main content to render next to the settings panel. */
  children: ReactNode;
  /**
   * Optional Tiptap editor used to resolve selected block settings when the
   * layout is rendered outside a BlockDocumentEditor context.
   */
  editor?: Editor | null;
  /**
   * Document ID required when providing an explicit editor prop.
   */
  documentId?: string;
  /** Additional classes for the resizable panel group. */
  className?: string;
  /** Additional classes for the main content panel. */
  contentClassName?: string;
  /** Additional classes for the settings panel container. */
  settingsPanelClassName?: string;
  /** Additional classes for the rendered BlockSettingsPanel. */
  settingsClassName?: string;
  /** Initial settings panel size in pixels. */
  defaultSize?: number;
  /** Minimum settings panel size in pixels. */
  minSize?: number;
  /** Maximum settings panel size in pixels or a CSS percentage string. */
  maxSize?: number | string;
};

/**
 * Reusable shell for selectable surfaces with a collapsible settings panel.
 *
 * The layout is intentionally generic: it works for block documents through
 * TipTap node selection and for dashboards through SelectablePanelWrapper.
 */
export const BlockSettingsPanelLayout: FC<BlockSettingsPanelLayoutProps> = ({
  children,
  editor,
  documentId,
  className,
  contentClassName,
  settingsPanelClassName,
  settingsClassName,
  defaultSize = 300,
  minSize = 300,
  maxSize = '35%',
}) => {
  const panelRef = useRef<ResizablePanelHandle>(null);
  const isOpen = useBlockSettingsStore(
    (state) => state.blockSettings.runtime.isSettingsPanelOpen,
  );
  const setSettingsPanelOpen = useBlockSettingsStore(
    (state) => state.blockSettings.setSettingsPanelOpen,
  );

  const handleClose = useCallback(() => {
    setSettingsPanelOpen(false);
  }, [setSettingsPanelOpen]);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.expand();
    } else {
      panelRef.current?.collapse();
    }
  }, [isOpen]);

  const handleResize = () => {
    const isCollapsed = panelRef.current?.isCollapsed();

    if (isCollapsed && isOpen) {
      setSettingsPanelOpen(false);
    }

    if (!isCollapsed && !isOpen) {
      setSettingsPanelOpen(true);
    }
  };

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className={cn('h-full', className)}
    >
      <ResizablePanel className={contentClassName}>{children}</ResizablePanel>
      <ResizableHandle className="w-px" />
      <ResizablePanel
        ref={panelRef}
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        className={cn('overflow-hidden', settingsPanelClassName)}
        collapsible={true}
        collapsedSize={0}
        onResize={handleResize}
      >
        {isOpen ? (
          <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!h-full">
            {editor !== undefined && documentId ? (
              <BlockSettingsPanel
                className={cn('h-full', settingsClassName)}
                editor={editor}
                documentId={documentId}
                onClose={handleClose}
              />
            ) : (
              <BlockSettingsPanel
                className={cn('h-full', settingsClassName)}
                onClose={handleClose}
              />
            )}
          </ScrollArea>
        ) : null}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
