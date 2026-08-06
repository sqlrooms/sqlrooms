import type {LayoutNodeSize} from '@sqlrooms/layout-config';
import type {PanelImperativeHandle} from 'react-resizable-panels';

/** Restore an expanded panel to its declared size when one is available. */
export function restoreExpandedPanelSize(
  handle: Pick<PanelImperativeHandle, 'expand' | 'resize'>,
  defaultSize: LayoutNodeSize['defaultSize'],
): void {
  if (defaultSize != null) {
    handle.resize(defaultSize);
  } else {
    handle.expand();
  }
}
