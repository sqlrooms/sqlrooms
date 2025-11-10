import {getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
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
            // isDisabled && 'opacity-50 cursor-not-allowed',
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
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );
  const togglePanel = useBaseRoomShellStore(
    (state) => state.layout.togglePanel,
  );
  const {icon: Icon, title} = panels[roomPanelType] ?? {};

  return (
    <SidebarButton
      key={roomPanelType}
      title={title ?? ''}
      isSelected={visibleRoomPanels.includes(roomPanelType)}
      isDisabled={!initialized}
      icon={Icon ?? (() => null)}
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

export {RoomShellSidebarButton, RoomShellSidebarButtons, SidebarButton};
