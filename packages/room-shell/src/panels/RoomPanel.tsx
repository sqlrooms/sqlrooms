import {cn} from '@sqlrooms/ui';
import {FC, PropsWithChildren} from 'react';
import {RoomPanelHeader} from './RoomPanelHeader';

const RoomPanel: FC<
  PropsWithChildren<{
    className?: string;
    type: string;
    showHeader?: boolean;
  }>
> = ({type: roomPanelType, children, className, showHeader = true}) => {
  return (
    <div className={cn('flex h-full flex-grow flex-col gap-3 p-3', className)}>
      {showHeader && <RoomPanelHeader panelKey={roomPanelType} />}
      <div className="flex h-full flex-grow flex-col gap-3 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export {RoomPanel};
