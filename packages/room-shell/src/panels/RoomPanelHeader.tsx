import {XIcon} from 'lucide-react';
import {FC} from 'react';
import {useBaseRoomShellStore} from '../RoomShellStore';
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
      <div className="flex w-full flex-row items-center gap-1.5">
        {showHeader && (
          <>
            {Icon ? <Icon className="h-3 w-3 text-muted-foreground" /> : null}
            <span className="text-muted-foreground text-[10px] uppercase">
              {title}
            </span>
          </>
        )}
        {children}
      </div>
      <div className=" flex gap-0">
        <PanelHeaderButton
          icon={<XIcon className='h-3 w-3'/>}
          onClick={() => togglePanel(type, false)}
          label={`Close panel "${title}"`}
        />
      </div>
    </div>
  );
};

export {RoomPanelHeader};
