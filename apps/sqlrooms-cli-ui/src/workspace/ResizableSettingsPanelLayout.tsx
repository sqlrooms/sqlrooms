import type {Editor} from '@sqlrooms/documents';
import {BlockSettingsPanel, useBlockSettingsStore} from '@sqlrooms/documents';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizablePanelHandle,
  ScrollArea,
} from '@sqlrooms/ui';
import {FC, ReactNode, useCallback, useEffect, useRef} from 'react';

export type ResizableSettingsPanelLayoutProps = {
  /** Main content to render in the left panel */
  children: ReactNode;
  /** Optional editor instance for worksheet artifacts */
  editor?: Editor | null;
  /** Optional document ID for worksheet artifacts */
  documentId?: string;
};

/**
 * Reusable layout for artifacts with a resizable settings panel on the right.
 *
 * Features:
 * - Main content takes up the left side
 * - Collapsible settings panel on the right (300px default, max 35%)
 * - Panel can be collapsed to 10px
 * - Synchronized collapse state
 *
 * Used by:
 * - WorksheetArtifact (with editor + documentId)
 * - DashboardArtifact (without editor/documentId)
 */
export const ResizableSettingsPanelLayout: FC<
  ResizableSettingsPanelLayoutProps
> = ({children, editor, documentId}) => {
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

  const onResize = () => {
    const isCollapsed = panelRef.current?.isCollapsed();

    if (isCollapsed && isOpen) {
      setSettingsPanelOpen(false);
    }

    if (!isCollapsed && !isOpen) {
      setSettingsPanelOpen(true);
    }
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel>{children}</ResizablePanel>
      <ResizableHandle className="w-px" />
      <ResizablePanel
        ref={panelRef}
        defaultSize={300}
        minSize={300}
        maxSize="35%"
        className="overflow-hidden"
        collapsible={true}
        collapsedSize={0}
        onResize={onResize}
      >
        {isOpen && editor !== undefined && documentId ? (
          <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!h-full">
            <BlockSettingsPanel
              className="h-full"
              editor={editor}
              documentId={documentId}
              onClose={handleClose}
            />
          </ScrollArea>
        ) : isOpen ? (
          <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!h-full">
            <BlockSettingsPanel className="h-full" onClose={handleClose} />
          </ScrollArea>
        ) : null}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
