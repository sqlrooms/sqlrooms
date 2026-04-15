import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {FC, useCallback, useEffect, useMemo, useRef} from 'react';
import {Mosaic, MosaicNode, MosaicPath} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {
  convertFromMosaicTree,
  convertToMosaicTree,
  updateMosaicSubtree,
} from '../mosaic/mosaic-utils';
import {NodeRenderProps} from './types';
import {MosaicTileRenderer} from './MosaicTileRenderer';
import {useLayoutRendererContext} from '../LayoutRendererContext';

const mosaicStyles = `
  .mosaic-split {
    z-index: 10;
  }
  .mosaic-split-line {
    width: 100%;
    height: 100%;
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover .mosaic-split-line {
    background-color: hsl(var(--primary) / 0.4);
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

export const MosaicRenderer: FC<NodeRenderProps<LayoutMosaicNode>> = ({
  node,
  path,
}) => {
  const treeRef = useRef(node.layout);

  const {onLayoutChange, rootLayout} = useLayoutRendererContext();

  useEffect(() => {
    treeRef.current = node.layout;
  }, [node.layout]);

  const mosaicValue = useMemo(
    () => (node.layout ? convertToMosaicTree(node.layout) : null),
    [node.layout],
  );

  const handleChange = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      const restored = newMosaicNodes
        ? convertFromMosaicTree(newMosaicNodes, treeRef.current)
        : null;

      const updated = updateMosaicSubtree(rootLayout, node.id, restored);
      onLayoutChange?.(updated);
    },
    [rootLayout, node.id, onLayoutChange],
  );

  const renderTile = useCallback(
    (panelId: string, tilePath: MosaicPath) => {
      return (
        <MosaicTileRenderer
          node={node}
          panelId={panelId}
          tilePath={tilePath}
          path={path}
        />
      );
    },
    [node, path],
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
