import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';

export type BlockDocumentChartRendererProps = {
  documentId: string;
  blockId: string;
  tableName: string;
  config: unknown;
  selectionGroupId?: string;
  caption?: string;
  readOnly?: boolean;
  onTableNameChange?: (tableName: string) => void;
  onConfigChange?: (config: unknown) => void;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlockDocumentChartRenderer = FC<BlockDocumentChartRendererProps>;

type BlockDocumentChartRendererContextValue = {
  renderer?: BlockDocumentChartRenderer;
};

const BlockDocumentChartRendererContext =
  createContext<BlockDocumentChartRendererContextValue>({});

/** Props for providing a chart renderer to block document chart node views. */
export type BlockDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlockDocumentChartRenderer;
}>;

/** Provides the chart renderer used by block document chart node views. */
export const BlockDocumentChartRendererProvider: FC<
  BlockDocumentChartRendererProviderProps
> = ({renderer, children}) => {
  const contextValue = useMemo(() => ({renderer}), [renderer]);

  return (
    <BlockDocumentChartRendererContext.Provider value={contextValue}>
      {children}
    </BlockDocumentChartRendererContext.Provider>
  );
};

export function useBlockDocumentChartRenderer() {
  return useContext(BlockDocumentChartRendererContext).renderer;
}
