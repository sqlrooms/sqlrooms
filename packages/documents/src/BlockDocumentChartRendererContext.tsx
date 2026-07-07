import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import type {BlockSettingsComponent} from './block-settings/types';

export type BlockDocumentChartRendererProps = {
  documentId: string;
  blockId: string;
  tableName: string;
  config: unknown;
  selectionGroupId?: string;
  caption?: string;
  /** Whether this chart block is the active TipTap node selection. */
  selected?: boolean;
  readOnly?: boolean;
  onTableNameChange?: (tableName: string) => void;
  onConfigChange?: (config: unknown) => void;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlockDocumentChartRenderer = FC<BlockDocumentChartRendererProps>;

export type BlockDocumentBlockHeaderActionsRenderContext = {
  blockDocumentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId?: string;
  title?: string;
};

export type BlockDocumentBlockHeaderActionsRenderer = (
  ctx: BlockDocumentBlockHeaderActionsRenderContext,
) => ReactNode;

type BlockDocumentChartRendererContextValue = {
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
  renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
};

const BlockDocumentChartRendererContext =
  createContext<BlockDocumentChartRendererContextValue>({});

/** Props for providing a chart renderer to block document chart node views. */
export type BlockDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
  renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
}>;

/** Provides the chart renderer used by block document chart node views. */
export const BlockDocumentChartRendererProvider: FC<
  BlockDocumentChartRendererProviderProps
> = ({renderer, settings, renderBlockHeaderActions, children}) => {
  const contextValue = useMemo(
    () => ({renderer, settings, renderBlockHeaderActions}),
    [renderer, settings, renderBlockHeaderActions],
  );

  return (
    <BlockDocumentChartRendererContext.Provider value={contextValue}>
      {children}
    </BlockDocumentChartRendererContext.Provider>
  );
};

export function useBlockDocumentChartRenderer() {
  return useContext(BlockDocumentChartRendererContext).renderer;
}

export function useBlockDocumentChartSettings() {
  return useContext(BlockDocumentChartRendererContext).settings;
}

export function useBlockDocumentChartRenderBlockHeaderActions() {
  return useContext(BlockDocumentChartRendererContext).renderBlockHeaderActions;
}
