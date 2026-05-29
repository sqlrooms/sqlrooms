import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type BlocksDocumentChartRendererProps = {
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

export type BlocksDocumentChartRenderer = FC<BlocksDocumentChartRendererProps>;

type BlocksDocumentChartRendererContextValue = {
  renderer?: BlocksDocumentChartRenderer;
};

const BlocksDocumentChartRendererContext =
  createContext<BlocksDocumentChartRendererContextValue>({});

export type BlocksDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlocksDocumentChartRenderer;
}>;

export const BlocksDocumentChartRendererProvider: FC<
  BlocksDocumentChartRendererProviderProps
> = ({renderer, children}) => {
  return (
    <BlocksDocumentChartRendererContext.Provider value={{renderer}}>
      {children}
    </BlocksDocumentChartRendererContext.Provider>
  );
};

export function useBlocksDocumentChartRenderer() {
  return useContext(BlocksDocumentChartRendererContext).renderer;
}
