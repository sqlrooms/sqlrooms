import {CSSProperties} from 'react';
import {LayoutNode} from '@sqlrooms/layout-config';

export type PreviewMode = 'insert' | 'wrap';

export type DockPreview = {
  containerStyle: CSSProperties;
  highlightStyle: CSSProperties;
  lineStyle: CSSProperties;
  mode: PreviewMode;
};

export type DockingContextValue = {
  activePanelId: string | null;
  preview: DockPreview | null;
  rootLayout: LayoutNode;
};
