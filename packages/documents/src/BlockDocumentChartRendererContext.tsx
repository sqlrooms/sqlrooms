import {
  createContext,
  useContext,
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

export type BlockDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlockDocumentChartRenderer;
}>;

export const BlockDocumentChartRendererProvider: FC<
  BlockDocumentChartRendererProviderProps
> = ({renderer, children}) => {
  return (
    <BlockDocumentChartRendererContext.Provider value={{renderer}}>
      {children}
    </BlockDocumentChartRendererContext.Provider>
  );
};

export function useBlockDocumentChartRenderer() {
  return useContext(BlockDocumentChartRendererContext).renderer;
}
