import {
  getLayoutNodeId,
  useGetPanel,
  useLayoutNodeContext,
} from '@sqlrooms/layout';
import {XIcon} from 'lucide-react';
import {FC, PropsWithChildren} from 'react';
import {useBaseRoomShellStore} from '../RoomShellSlice';
import {PanelHeaderButton} from './RoomHeaderButton';

type RoomPanelHeaderProps = PropsWithChildren<{
  showHeader?: boolean;
}>;

const RoomPanelHeader: FC<RoomPanelHeaderProps> = ({
  showHeader = true,
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

  const nodeId = getLayoutNodeId(layoutContext.node);
  const ancestorTabs = findAncestorOfType(nodeId, 'tabs');

  return (
    <div className="flex">
      <div
        className="flex w-full cursor-grab flex-row items-center gap-2 active:cursor-grabbing"
        data-layout-drag-handle="true"
      >
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
