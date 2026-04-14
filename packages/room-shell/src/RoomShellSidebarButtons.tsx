import {getVisibleLayoutPanels} from '@sqlrooms/layout';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {FC, useMemo} from 'react';
import {useBaseRoomShellStore} from './RoomShellSlice';

const SidebarButton: FC<{
  className?: string;
  title: string;
  isSelected: boolean;
  isDisabled?: boolean;
  icon: React.ComponentType<{className?: string}>;
  onClick: () => void;
}> = ({
  className,
  title,
  isSelected,
  isDisabled = false,
  icon: Icon,
  onClick,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-none',
            isSelected ? 'bg-secondary' : 'hover:bg-secondary/50',
            className,
          )}
          disabled={isDisabled}
          onClick={onClick}
        >
          {Icon ? <Icon className="h-5 w-5" /> : title}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const RoomShellSidebarButton: FC<{roomPanelType: string}> = ({
  roomPanelType,
}) => {
  const initialized = useBaseRoomShellStore((state) => state.room.initialized);
  const layout = useBaseRoomShellStore((state) => state.layout.config);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const visibleRoomPanels = useMemo(
    () => getVisibleLayoutPanels(layout),
    [layout],
  );
  const togglePanel = useBaseRoomShellStore(
    (state) => state.layout.togglePanel,
  );
  const info = panels[roomPanelType];

  return (
    <SidebarButton
      key={roomPanelType}
      title={info?.title ?? ''}
      isSelected={visibleRoomPanels.includes(roomPanelType)}
      isDisabled={!initialized}
      icon={info?.icon ?? (() => null)}
      onClick={() => togglePanel(roomPanelType)}
    />
  );
};

const RoomShellSidebarButtons: FC<{className?: string}> = ({className}) => {
  const panels = useBaseRoomShellStore((state) => state.layout.panels);

  return (
    <div className={cn('flex h-full grow flex-col', className)}>
      <div className="flex flex-col gap-2">
        {panels
          ? Object.keys(panels)
              .filter((key) => panels[key]?.placement === 'sidebar')
              .map((type) => (
                <RoomShellSidebarButton key={type} roomPanelType={type} />
              ))
          : null}
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        {Object.keys(panels)
          .filter((key) => panels[key]?.placement === 'sidebar-bottom')
          .map((type) => (
            <RoomShellSidebarButton key={type} roomPanelType={type} />
          ))}
      </div>
    </div>
  );
};

/**
 * Renders sidebar buttons for all panels belonging to a tabs node.
 * Clicking the active tab's button collapses the node;
 * clicking an inactive tab expands the node and switches to that tab.
 */
const TabButtons: FC<{
  tabsId?: string;
  className?: string;
}> = ({tabsId = 'left', className}) => {
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const getTabs = useBaseRoomShellStore((state) => state.layout.getTabs);
  const activeTab = useBaseRoomShellStore((state) =>
    state.layout.getActiveTab(tabsId),
  );
  const collapsed = useBaseRoomShellStore((state) =>
    state.layout.isCollapsed(tabsId),
  );
  const setActiveTab = useBaseRoomShellStore(
    (state) => state.layout.setActiveTab,
  );
  const setCollapsed = useBaseRoomShellStore(
    (state) => state.layout.setCollapsed,
  );
  const initialized = useBaseRoomShellStore((state) => state.room.initialized);

  const tabIds = useMemo(() => getTabs(tabsId), [getTabs, tabsId]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {tabIds.map((tabId) => {
        const info = panels[tabId];
        const isSelected = activeTab === tabId && !collapsed;
        return (
          <SidebarButton
            key={tabId}
            title={info?.title ?? tabId}
            icon={info?.icon ?? (() => null)}
            isSelected={isSelected}
            isDisabled={!initialized}
            onClick={() => {
              if (isSelected) {
                setCollapsed(tabsId, true);
              } else {
                setCollapsed(tabsId, false);
                setActiveTab(tabsId, tabId);
              }
            }}
          />
        );
      })}
    </div>
  );
};

/** @deprecated Use TabButtons instead */
const AreaPanelButtons = TabButtons;

export {
  AreaPanelButtons,
  TabButtons,
  RoomShellSidebarButton,
  RoomShellSidebarButtons,
  SidebarButton,
};
