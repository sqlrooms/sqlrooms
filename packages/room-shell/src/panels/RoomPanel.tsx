import {cn} from '@sqlrooms/ui';
import {FC, PropsWithChildren} from 'react';
import {RoomPanelHeader} from './RoomPanelHeader';

type RoomPanelProps = PropsWithChildren<{
  className?: string;
  showHeader?: boolean;
}>;

const RoomPanel: FC<RoomPanelProps> = ({
  children,
  className,
  showHeader = true,
}) => {
  return (
    <div className={cn('flex h-full grow flex-col gap-3 p-2', className)}>
      {showHeader && <RoomPanelHeader />}
      <div className="flex h-full grow flex-col gap-3 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export {RoomPanel};
