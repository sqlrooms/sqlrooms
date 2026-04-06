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
import {MosaicCloseButton} from './MosaicCloseButton';

const mosaicStyles = `
  .mosaic-split {
    background-color: hsl(var(--border) / 0.2);
    z-index: 10;
  }
  .mosaic-split:hover {
    background-color: hsl(var(--primary) / 0.4);
    z-index: 10;
  }
  .mosaic-root {
    top: 0; left: 0; right: 0; bottom: 0;
  }
  .mosaic-window-toolbar {
    background: var(--color-background) !important;
    position: relative;
    z-index: 1;
  }
  .mosaic-tile {
    margin: 0;
  }
  .mosaic-tabs-toolbar {
    display: none !important;
  }
  .mosaic-window-body {
    background: var(--color-background) !important;
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

      const content = info?.render ? (
        info.render(context)
      ) : info?.component ? (
        <div className="h-full w-full overflow-hidden p-2">
          <info.component {...context} />
        </div>
      ) : null;

      if (!content) return <></>;

      if (!draggable) return <>{content}</>;

      const title = info?.title ?? panelId;
      const showCloseButton = info?.closeButton ?? true;
      const Icon = info?.icon;

      return (
        <MosaicWindow<string>
          title={title}
          path={tilePath}
          draggable
          renderToolbar={() => (
            <div className="mosaic-window-toolbar flex w-full items-center justify-between">
              <div className="mosaic-window-title flex items-center">
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {title}
              </div>
              <div className="mosaic-window-controls flex items-center">
                {showCloseButton && <MosaicCloseButton />}
              </div>
            </div>
          )}
        >
          {content}
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
