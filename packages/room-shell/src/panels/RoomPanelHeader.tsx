import {XIcon} from 'lucide-react';
import {FC} from 'react';
import {useBaseRoomShellStore} from '../RoomShellSlice';
import {PanelHeaderButton} from './RoomHeaderButton';

const RoomPanelHeader: FC<{
  panelKey: string;
  showHeader?: boolean;
  children?: React.ReactNode;
}> = (props) => {
  const {showHeader = true, panelKey: type, children} = props;
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const {icon: Icon, title} = panels[type] ?? {};
  const togglePanel = useBaseRoomShellStore(
    (state) => state.layout.togglePanel,
  );

  return (
    <div className="flex">
      <div className="flex w-full flex-row items-center gap-2">
        {showHeader && (
          <>
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <h2 className="text-muted-foreground text-xs font-semibold uppercase">
              {title}
            </h2>
          </>
        )}
        {children}
      </div>
      <div className="bg-secondary/50 flex gap-0">
        <PanelHeaderButton
          icon={<XIcon className="w-[18px]" />}
          onClick={() => togglePanel(type)}
          label={`Close panel "${title}"`}
        />
      </div>
    </div>
  );
};

export {RoomPanelHeader};
