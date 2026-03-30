import {FC} from 'react';
import type {PanelRenderContext} from '../LayoutSlice';
import {lookupPanelInfo, NodeRenderProps} from './types';

export const LeafRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {panelId: string}
> = ({panelId, path, containerType, containerId, panels, resolvePanel}) => {
  const context: PanelRenderContext = {
    panelId,
    containerType,
    containerId,
    path,
  };

  const info = lookupPanelInfo(panelId, panels, resolvePanel);

  if (info?.render) {
    return <>{info.render(context)}</>;
  }

  if (!info?.component) return null;

  const PanelComp = info.component;
  return (
    <div className="h-full w-full overflow-hidden p-2">
      <PanelComp {...context} />
    </div>
  );
};
