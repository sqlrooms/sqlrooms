import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
} from '@sqlrooms/ui';
import React, {FC, useEffect, useRef, useState} from 'react';

type MosaicDashboardPanelLayoutProps = {
  isOpen?: boolean;
  onIsOpenChange?: (isOpen: boolean) => void;
  settings?: React.ReactNode;
  content?: React.ReactNode;
};

const MIN_WIDTH_FOR_SPLIT_VIEW = 200; // pixels

export const MosaicDashboardPanelLayout: FC<
  MosaicDashboardPanelLayoutProps
> = ({isOpen, onIsOpenChange, settings, content}) => {
  const panelRef = useRef<ResizablePanelHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(
    window.innerWidth,
  );

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.expand();
    } else {
      panelRef.current?.collapse();
    }
  }, [isOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const onResize = () => {
    const isCollapsed = panelRef.current?.isCollapsed();

    if (isCollapsed && isOpen) {
      onIsOpenChange?.(false);
    }

    if (!isCollapsed && !isOpen) {
      onIsOpenChange?.(true);
    }
  };

  // If container is too small and settings are open, show only settings
  if (containerWidth < MIN_WIDTH_FOR_SPLIT_VIEW && isOpen) {
    return (
      <div ref={containerRef} className="h-full overflow-auto">
        {settings}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full">
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
          {settings}
        </ResizablePanel>
        <ResizableHandle className="w-px" />
        <ResizablePanel>{content}</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
