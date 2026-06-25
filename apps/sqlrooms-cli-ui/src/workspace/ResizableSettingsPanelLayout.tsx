import type {Editor} from '@sqlrooms/documents';
import {BlockSettingsPanel} from '@sqlrooms/documents';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizablePanelHandle,
} from '@sqlrooms/ui';
import {FC, ReactNode, useEffect, useRef, useState} from 'react';

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
  const [isOpen, setIsOpen] = useState(true);

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
      setIsOpen(false);
    }

    if (!isCollapsed && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel>{children}</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        ref={panelRef}
        defaultSize={300}
        minSize={300}
        maxSize="35%"
        className="overflow-hidden"
        collapsible={true}
        collapsedSize={10}
        onResize={onResize}
      >
        {isOpen && (
          <BlockSettingsPanel
            className="border-l"
            editor={editor}
            documentId={documentId}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
