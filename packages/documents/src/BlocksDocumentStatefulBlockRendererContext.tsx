import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type BlocksDocumentStatefulBlockRendererProps = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership?: string;
  title?: string;
  caption?: string;
  readOnly?: boolean;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlocksDocumentStatefulBlockRenderer =
  FC<BlocksDocumentStatefulBlockRendererProps>;

export type BlocksDocumentStatefulBlockRenderers = Record<
  string,
  BlocksDocumentStatefulBlockRenderer
>;

export type BlocksDocumentStatefulBlockType = {
  blockType: string;
  label?: string;
  description?: string;
  createNode?: (blockId: string) => Record<string, unknown>;
};

type BlocksDocumentStatefulBlockRendererContextValue = {
  renderers: BlocksDocumentStatefulBlockRenderers;
  blockTypes: BlocksDocumentStatefulBlockType[];
};

const BlocksDocumentStatefulBlockRendererContext =
  createContext<BlocksDocumentStatefulBlockRendererContextValue>({
    renderers: {},
    blockTypes: [],
  });

export type BlocksDocumentStatefulBlockRendererProviderProps =
  PropsWithChildren<{
    renderers?: BlocksDocumentStatefulBlockRenderers;
    blockTypes?: BlocksDocumentStatefulBlockType[];
  }>;

export const BlocksDocumentStatefulBlockRendererProvider: FC<
  BlocksDocumentStatefulBlockRendererProviderProps
> = ({renderers = {}, blockTypes, children}) => {
  const supportedBlockTypes =
    blockTypes ??
    Object.keys(renderers).map((blockType) => ({
      blockType,
    }));

  return (
    <BlocksDocumentStatefulBlockRendererContext.Provider
      value={{renderers, blockTypes: supportedBlockTypes}}
    >
      {children}
    </BlocksDocumentStatefulBlockRendererContext.Provider>
  );
};

export function useBlocksDocumentStatefulBlockRenderer(blockType: string) {
  return useContext(BlocksDocumentStatefulBlockRendererContext).renderers[
    blockType
  ];
}

export function useBlocksDocumentStatefulBlockTypes() {
  return useContext(BlocksDocumentStatefulBlockRendererContext).blockTypes;
}
