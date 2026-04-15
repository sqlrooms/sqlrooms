import {LayoutNodeSize} from '@sqlrooms/layout-config';
import {MOSAIC_NODE_KEY_PREFIX} from '../mosaic/mosaic-utils';
import {ResizablePanelOrientation} from '@sqlrooms/ui';

export function convertLayoutNodeSizeToStyle(
  size: LayoutNodeSize,
  orientation: ResizablePanelOrientation,
): React.CSSProperties {
  return orientation === 'vertical'
    ? {
        height: (size.defaultSize ?? 'auto') as string | number | undefined,
        minHeight: size.minSize,
        maxHeight: size.maxSize,
      }
    : {
        width: size.defaultSize ?? 'auto',
        minWidth: size.minSize,
        maxWidth: size.maxSize,
      };
}

export function extractPanelId(tabId: string): string {
  if (tabId.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
    return tabId.slice(MOSAIC_NODE_KEY_PREFIX.length);
  }

  return tabId;
}
