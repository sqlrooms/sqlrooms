import {useCallback, useState} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {useDebouncedCallback} from '@sqlrooms/ui';
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
};

const DEBOUNCE_DELAY = 300;

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

  const debouncedOnLayoutChange = useDebouncedCallback(() => {
    // Don't attempt to update if there's no callback provided
    if (!onLayoutChange) {
      return;
    }

    const restored = currentLayout
      ? convertFromMosaicTree(currentLayout, layout)
      : null;

    const updated = updateMosaicSubtree(rootLayout, nodeId, restored);

    onLayoutChange(updated);
  }, DEBOUNCE_DELAY);

  const handleChange = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      // Update visual state immediately
      setState((prev) => ({
        ...prev,
        currentLayout: newMosaicNodes,
      }));

      // Trigger debounced store update
      debouncedOnLayoutChange();
    },
    [debouncedOnLayoutChange],
  );

  return {
    value: currentLayout,
    handleChange,
  };
}
