import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
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

type BlockDocumentChartRendererContextValue = {
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
};

const BlockDocumentChartRendererContext =
  createContext<BlockDocumentChartRendererContextValue>({});

/** Props for providing a chart renderer to block document chart node views. */
export type BlockDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
}>;

/** Provides the chart renderer used by block document chart node views. */
export const BlockDocumentChartRendererProvider: FC<
  BlockDocumentChartRendererProviderProps
> = ({renderer, settings, children}) => {
  const contextValue = useMemo(
    () => ({renderer, settings}),
    [renderer, settings],
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
