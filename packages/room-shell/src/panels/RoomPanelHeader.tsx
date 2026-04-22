import {useGetPanel, useLayoutNodeContext} from '@sqlrooms/layout';
import {XIcon} from 'lucide-react';
import {FC, PropsWithChildren} from 'react';
import {useBaseRoomShellStore} from '../RoomShellSlice';
import {PanelHeaderButton} from './RoomHeaderButton';

type RoomPanelHeaderProps = PropsWithChildren<{
  panelKey: string;
  showHeader?: boolean;
}>;

const RoomPanelHeader: FC<RoomPanelHeaderProps> = ({
  showHeader = true,
  panelKey,
  children,
}) => {
  const layoutContext = useLayoutNodeContext();
  const panelInfo = useGetPanel(layoutContext.node);
  const {icon: Icon, title} = panelInfo ?? {};

  const findAncestorOfType = useBaseRoomShellStore(
    (state) => state.layout.findAncestorOfType,
  );

  const toggleCollapsed = useBaseRoomShellStore(
    (state) => state.layout.toggleCollapsed,
  );

  const ancestorTabs = findAncestorOfType(panelKey, 'tabs');

  return (
    <div className="flex">
      <div className="flex w-full flex-row items-center gap-2">
        {showHeader && (
          <>
            {Icon && <Icon className="h-4 w-4" />}
            <h2 className="text-muted-foreground text-xs font-semibold uppercase">
              {title}
            </h2>
          </>
        )}
        {children}
      </div>
      {ancestorTabs && (
        <div className="bg-secondary/50 flex gap-0">
          <PanelHeaderButton
            icon={<XIcon className="w-[18px]" />}
            onClick={() => toggleCollapsed(ancestorTabs.id)}
            label={`Close panel "${title}"`}
          />
        </div>
      )}
    </div>
  );
};

export {RoomPanelHeader};
