import {MOSAIC_NODE_KEY_PREFIX} from '../mosaic/mosaic-utils';
import {SizeProps} from './types';
import {ResizablePanelOrientation} from '@sqlrooms/ui';

export function convertSizePropsToStyle(
  sizeProps: SizeProps,
  orientation: ResizablePanelOrientation,
): React.CSSProperties {
  return orientation === 'vertical'
    ? {
        height: (sizeProps.defaultSize ?? 'auto') as
          | string
          | number
          | undefined,
        minHeight: sizeProps.minSize,
        maxHeight: sizeProps.maxSize,
      }
    : {
        width: sizeProps.defaultSize ?? 'auto',
        minWidth: sizeProps.minSize,
        maxWidth: sizeProps.maxSize,
      };
}

export function extractPanelId(tabId: string): string {
  if (tabId.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
    return tabId.slice(MOSAIC_NODE_KEY_PREFIX.length);
  }

  return tabId;
}
