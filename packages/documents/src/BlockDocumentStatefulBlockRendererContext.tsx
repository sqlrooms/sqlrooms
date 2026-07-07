import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import type {BlockSettingsComponent} from './block-settings/types';

export type BlockDocumentStatefulBlockRendererProps = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership?: string;
  title?: string;
  caption?: string;
  height?: number;
  selected?: boolean;
  readOnly?: boolean;
  onTitleChange?: (title: string | undefined) => void;
  onCaptionChange?: (caption: string | undefined) => void;
};

export type BlockDocumentStatefulBlockRenderer =
  FC<BlockDocumentStatefulBlockRendererProps>;

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
  settings?: BlockSettingsComponent;
  hasOwnHeaderActions?: boolean;
  createNode?: (
    blockId: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => Record<string, unknown>;
};

type BlockDocumentStatefulBlockRendererContextValue = {
  renderers: BlockDocumentStatefulBlockRenderers;
  blockTypes: BlockDocumentStatefulBlockType[];
  renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
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
    renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
  }>;

export const BlockDocumentStatefulBlockRendererProvider: FC<
  BlockDocumentStatefulBlockRendererProviderProps
> = ({renderers = {}, blockTypes, renderBlockHeaderActions, children}) => {
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
      renderBlockHeaderActions,
    }),
    [renderers, supportedBlockTypes, renderBlockHeaderActions],
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

export function useBlockDocumentRenderBlockHeaderActions() {
  return useContext(BlockDocumentStatefulBlockRendererContext)
    .renderBlockHeaderActions;
}

export function useBlockDocumentStatefulBlockSettings(blockType: string) {
  return useBlockDocumentStatefulBlockTypes().find(
    (candidate) => candidate.blockType === blockType,
  )?.settings;
}
