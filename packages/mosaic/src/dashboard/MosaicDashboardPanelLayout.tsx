import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import React, {FC, useEffect, useRef} from 'react';

type MosaicDashboardPanelLayoutProps = {
  isOpen?: boolean;
  onIsOpenChange?: (isOpen: boolean) => void;
  settings?: React.ReactNode;
  content?: React.ReactNode;
};

export const MosaicDashboardPanelLayout: FC<
  MosaicDashboardPanelLayoutProps
> = ({isOpen, onIsOpenChange, settings, content}) => {
  const panelRef = useRef<ResizablePanelHandle>(null);

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
      onIsOpenChange?.(false);
    }

    if (!isCollapsed && !isOpen) {
      onIsOpenChange?.(true);
    }
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel
        ref={panelRef}
        defaultSize="35%"
        minSize="30%"
        maxSize="70%"
        collapsible={true}
        collapsedSize={0}
        className="overflow-auto"
        onResize={onResize}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">Chart settings</span>

          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => panelRef.current?.collapse()}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-4">{settings}</div>
      </ResizablePanel>
      <ResizableHandle className="w-px" />
      <ResizablePanel>{content}</ResizablePanel>
    </ResizablePanelGroup>
  );
};
