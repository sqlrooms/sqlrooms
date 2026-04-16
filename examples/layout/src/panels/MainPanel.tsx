import {
  getLayoutNodeId,
  RoomPanelComponent,
  SplitLayout,
} from '@sqlrooms/layout';
import {useSplitNodeContext} from '@sqlrooms/layout/dist/LayoutNodeContext';

export const MainPanel: RoomPanelComponent = () => {
  const {node} = useSplitNodeContext();

  return (
    <SplitLayout.PanelGroup>
      {node.children.map((child, i) => {
        const panelId = getLayoutNodeId(child);

        return (
          <SplitLayout.Panel
            key={panelId}
            node={child}
            nodeIndex={i}
            handleComponent={<SplitLayout.Handle className="py-1" withHandle />}
          >
            <SplitLayout.PanelContent node={child} />
          </SplitLayout.Panel>
        );
      })}
    </SplitLayout.PanelGroup>
  );
};
