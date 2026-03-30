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
  const resolvePanel = useBaseRoomShellStore(
    (state) => state.layout.resolvePanel,
  );
  const visibleRoomPanels = useMemo(
    () => getVisibleLayoutPanels(layout),
    [layout],
  );
  const togglePanel = useBaseRoomShellStore(
    (state) => state.layout.togglePanel,
  );
  const info = panels[roomPanelType] ?? resolvePanel?.(roomPanelType);

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
 * Renders sidebar buttons for all panels belonging to a named area.
 * Clicking the active panel's button collapses the area;
 * clicking an inactive panel expands the area and switches to that tab.
 */
const AreaPanelButtons: FC<{
  area: string;
  className?: string;
}> = ({area, className}) => {
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const resolvePanel = useBaseRoomShellStore(
    (state) => state.layout.resolvePanel,
  );
  const activePanel = useBaseRoomShellStore((state) =>
    state.layout.getActivePanel(area),
  );
  const isCollapsed = useBaseRoomShellStore((state) =>
    state.layout.isAreaCollapsed(area),
  );
  const setActivePanel = useBaseRoomShellStore(
    (state) => state.layout.setActivePanel,
  );
  const setAreaCollapsed = useBaseRoomShellStore(
    (state) => state.layout.setAreaCollapsed,
  );
  const initialized = useBaseRoomShellStore((state) => state.room.initialized);

  const areaPanels = useMemo(
    () =>
      Object.entries(panels).filter(
        ([, info]) => info.area === area || info.placement === area,
      ),
    [panels, area],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {areaPanels.map(([panelId, staticInfo]) => {
        const info = staticInfo ?? resolvePanel?.(panelId);
        const isSelected = activePanel === panelId && !isCollapsed;
        return (
          <SidebarButton
            key={panelId}
            title={info?.title ?? panelId}
            icon={info?.icon ?? (() => null)}
            isSelected={isSelected}
            isDisabled={!initialized}
            onClick={() => {
              if (isSelected) {
                setAreaCollapsed(area, true);
              } else {
                setAreaCollapsed(area, false);
                setActivePanel(area, panelId);
              }
            }}
          />
        );
      })}
    </div>
  );
};

export {
  AreaPanelButtons,
  RoomShellSidebarButton,
  RoomShellSidebarButtons,
  SidebarButton,
};
