import {useCallback, useState} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {
  convertFromMosaicTree,
  convertToMosaicTree,
  updateMosaicSubtree,
} from '../../mosaic/mosaic-utils';
import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {useLayoutRendererContext} from '../../LayoutRendererContext';

type UseMosaicRendererLayoutReturn = {
  value: MosaicNode<string> | null;
  handleChange: (newMosaicNodes: MosaicNode<string> | null) => void;
  handleRelease: (newMosaicNodes: MosaicNode<string> | null) => void;
};

export function useMosaicRendererLayout({
  layout,
  id: nodeId,
}: LayoutMosaicNode): UseMosaicRendererLayoutReturn {
  const {onLayoutChange, rootLayout} = useLayoutRendererContext();

  const [{prevLayout, currentLayout}, setState] = useState(() => ({
    prevLayout: layout,
    currentLayout: layout ? convertToMosaicTree(layout) : null,
  }));

  // Update state when nodeLayout changes externally
  if (prevLayout !== layout) {
    const newValue = layout ? convertToMosaicTree(layout) : null;

    setState({
      prevLayout: layout,
      currentLayout: newValue,
    });
  }

  const handleChange = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      // Update visual state immediately
      setState((prev) => ({
        ...prev,
        currentLayout: newMosaicNodes,
      }));
    },
    [],
  );

  const handleRelease = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      setState((prev) => ({
        ...prev,
        currentLayout: newMosaicNodes,
      }));

      const restored = newMosaicNodes
        ? convertFromMosaicTree(newMosaicNodes, layout)
        : null;

      const updated = updateMosaicSubtree(rootLayout, nodeId, restored);

      onLayoutChange?.(updated);
    },
    [layout, nodeId, onLayoutChange, rootLayout],
  );

  return {
    value: currentLayout,
    handleChange,
    handleRelease,
  };
}
