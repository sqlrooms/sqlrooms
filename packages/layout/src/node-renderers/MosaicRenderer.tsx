import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {FC, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Mosaic,
  MosaicNode,
  MosaicPath,
  MosaicWindow,
} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import type {PanelRenderContext} from '../LayoutSlice';
import {
  convertFromMosaicTree,
  convertToMosaicTree,
  updateMosaicSubtree,
} from '../mosaic/mosaic-utils';
import {lookupPanelInfo, NodeRenderProps} from './types';

const mosaicStyles = `
  .mosaic-split {
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover {
    background-color: hsl(var(--primary) / 0.4);
  }
  .mosaic-root {
    top: 0; left: 0; right: 0; bottom: 0;
  }
  .mosaic-tile {
    margin: 0;
  }
  .mosaic-tabs-toolbar {
    display: none !important;
  }
`;

export const MosaicRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutMosaicNode}
> = ({node, path, panels, rootLayout, onLayoutChange}) => {
  const treeRef = useRef(node.nodes);
  useEffect(() => {
    treeRef.current = node.nodes;
  }, [node.nodes]);

  const mosaicValue = useMemo(
    () => convertToMosaicTree(node.nodes),
    [node.nodes],
  );

  const handleChange = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      const restored = convertFromMosaicTree(newMosaicNodes, treeRef.current);
      const updated = updateMosaicSubtree(rootLayout, node.id, restored);
      onLayoutChange?.(updated);
    },
    [rootLayout, node.id, onLayoutChange],
  );

  const draggable = node.draggable !== false;

  const renderTile = useCallback(
    (panelId: string, tilePath: MosaicPath) => {
      const context: PanelRenderContext = {
        panelId,
        containerType: 'mosaic',
        containerId: node.id,
        path: [...path, ...tilePath],
      };

      const info = lookupPanelInfo(context, panels);

      if (info?.render) {
        return <>{info.render(context)}</>;
      }

      if (!info?.component) return <></>;

      const PanelComp = info.component;
      const body = (
        <div className="h-full w-full overflow-hidden p-2">
          <PanelComp {...context} />
        </div>
      );

      if (!draggable) return body;

      return (
        <MosaicWindow<string>
          title={info.title ?? panelId}
          path={tilePath}
          draggable
        >
          {body}
        </MosaicWindow>
      );
    },
    [panels, draggable, node.id, path],
  );

  return (
    <div className="relative h-full w-full">
      <style>{mosaicStyles}</style>
      <Mosaic<string>
        value={mosaicValue}
        onChange={handleChange}
        renderTile={renderTile}
        className=""
      />
    </div>
  );
};
