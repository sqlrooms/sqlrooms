import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {FC, useMemo} from 'react';
import {useBaseRoomShellStore} from './RoomShellStore';
import { getVisibleMosaicLayoutPanels } from '@sqlrooms/layout';

const SidebarButton: FC<{
  className?: string;
  title: string;
  isSelected: boolean;
  isDisabled?: boolean;
  icon?: React.ComponentType<any>;
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
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild >
        <Button
          variant="ghost"
          className={cn(
            'h-9 w-9 rounded hover:bg-primary/10 p-0 flex items-center justify-center shrink-0',
            isSelected && 'bg-primary/10' ,
            className,
          )}
          disabled={isDisabled}
          onClick={onClick}
        >
          {Icon ? <Icon strokeWidth={1.5}/> : title}
        </Button>
      </TooltipTrigger >
      <TooltipContent side="right" >
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const RoomShellSidebarButton: FC<{roomPanelType: string}> = ({
  roomPanelType,
}) => {
  const initialized = useBaseRoomShellStore((state) => state.room.initialized);
  const layout = useBaseRoomShellStore((state) => state.config.layout);
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
      icon={Icon}
      onClick={() => togglePanel(roomPanelType)}
    />
  );
};

const RoomShellSidebarButtons: FC<{className?: string}> = ({className}) => {
  const panels = useBaseRoomShellStore((state) => state.layout.panels);

  return (
    <div className={cn('flex h-full grow flex-col', className)}>
      <div className="flex flex-col gap-2">
        {Object.keys(panels)
          .filter((key) => panels[key]?.placement !== 'main')
          .map((type) => (
            <RoomShellSidebarButton key={type} roomPanelType={type} />
        ))}
      </div>
      <div className="flex-1" />
    </div>
  );
};

export {RoomShellSidebarButton, RoomShellSidebarButtons, SidebarButton};
