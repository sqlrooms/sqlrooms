import {LayoutNodeSize} from '@sqlrooms/layout-config';
import {MOSAIC_NODE_KEY_PREFIX} from '../mosaic/mosaic-utils';

export function convertLayoutNodeSizeToStyle(
  size: LayoutNodeSize,
  direction: 'row' | 'column',
): React.CSSProperties {
  return direction === 'column'
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
