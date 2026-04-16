import {cn} from '@sqlrooms/ui';
import {FC, PropsWithChildren} from 'react';
import {RoomPanelHeader} from './RoomPanelHeader';

type RoomPanelProps = PropsWithChildren<{
  className?: string;
  type: string;
  showHeader?: boolean;
}>;

const RoomPanel: FC<RoomPanelProps> = ({
  type: panelKey,
  children,
  className,
  showHeader = true,
}) => {
  return (
    <div className={cn('flex h-full grow flex-col gap-3', className)}>
      {showHeader && <RoomPanelHeader panelKey={panelKey} />}
      <div className="flex h-full grow flex-col gap-3 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export {RoomPanel};
