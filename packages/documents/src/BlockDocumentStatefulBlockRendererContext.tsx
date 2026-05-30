import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';

export type BlockDocumentStatefulBlockRendererProps = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership?: string;
  title?: string;
  caption?: string;
  height?: number;
  readOnly?: boolean;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlockDocumentStatefulBlockRenderer =
  FC<BlockDocumentStatefulBlockRendererProps>;

export type BlockDocumentStatefulBlockRenderers = Record<
  string,
  BlockDocumentStatefulBlockRenderer
>;

export type BlockDocumentStatefulBlockCreateNodeOptions = {
  initialText?: string;
};

export type BlockDocumentStatefulBlockType = {
  blockType: string;
  label?: string;
  description?: string;
  resizableHeight?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  requireScrollModifier?: boolean;
  scrollHintLabel?: string;
  createNode?: (
    blockId: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => Record<string, unknown>;
};

type BlockDocumentStatefulBlockRendererContextValue = {
  renderers: BlockDocumentStatefulBlockRenderers;
  blockTypes: BlockDocumentStatefulBlockType[];
};

const BlockDocumentStatefulBlockRendererContext =
  createContext<BlockDocumentStatefulBlockRendererContextValue>({
    renderers: {},
    blockTypes: [],
  });

export type BlockDocumentStatefulBlockRendererProviderProps =
  PropsWithChildren<{
    renderers?: BlockDocumentStatefulBlockRenderers;
    blockTypes?: BlockDocumentStatefulBlockType[];
  }>;

export const BlockDocumentStatefulBlockRendererProvider: FC<
  BlockDocumentStatefulBlockRendererProviderProps
> = ({renderers = {}, blockTypes, children}) => {
  const supportedBlockTypes = useMemo(
    () =>
      blockTypes ??
      Object.keys(renderers).map((blockType) => ({
        blockType,
      })),
    [blockTypes, renderers],
  );
  const contextValue = useMemo(
    () => ({
      renderers,
      blockTypes: supportedBlockTypes,
    }),
    [renderers, supportedBlockTypes],
  );

  return (
    <BlockDocumentStatefulBlockRendererContext.Provider value={contextValue}>
      {children}
    </BlockDocumentStatefulBlockRendererContext.Provider>
  );
};

export function useBlockDocumentStatefulBlockRenderer(blockType: string) {
  return useContext(BlockDocumentStatefulBlockRendererContext).renderers[
    blockType
  ];
}

export function useBlockDocumentStatefulBlockTypes() {
  return useContext(BlockDocumentStatefulBlockRendererContext).blockTypes;
}
