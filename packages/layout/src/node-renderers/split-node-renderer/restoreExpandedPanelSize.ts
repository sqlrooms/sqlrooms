import type {LayoutNodeSize} from '@sqlrooms/layout-config';
import type {PanelImperativeHandle} from 'react-resizable-panels';

/**
 * Restore an expanded panel to its declared size when possible.
 *
 * RRP can snap a resize below `minSize` back to the collapsed size. In that
 * case, fall back to its normal expansion behavior so the panel remains
 * visible and the declared `collapsed: false` state is truthful.
 */
export function restoreExpandedPanelSize(
  handle: Pick<PanelImperativeHandle, 'expand' | 'isCollapsed' | 'resize'>,
  defaultSize: LayoutNodeSize['defaultSize'],
): void {
  if (defaultSize != null) {
    handle.resize(defaultSize);
    if (handle.isCollapsed()) {
      handle.expand();
    }
  } else {
    handle.expand();
  }
}
