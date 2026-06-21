import {
  getLayoutNodeId,
  RoomPanelComponent,
  SplitLayout,
  useSplitNodeContext,
} from '@sqlrooms/layout';

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
