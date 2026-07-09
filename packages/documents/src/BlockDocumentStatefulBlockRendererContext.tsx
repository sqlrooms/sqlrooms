import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import type {BlockSettingsComponent} from './block-settings/types';
import type {BlockDocumentBlockHeaderActionsRenderer} from './BlockDocumentBlockHeaderActions';

export type BlockDocumentStatefulBlockRendererProps = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership?: string;
  /** User-facing label shown for the block in the document flow. */
  caption?: string;
  /** Table identity this block reads from (for table-bound types like `data-table`). */
  tableName?: string;
  height?: number;
  /** Actions rendered by the block document host in the block's header. */
  headerActions?: ReactNode;
  selected?: boolean;
  readOnly?: boolean;
  onCaptionChange?: (caption: string | undefined) => void;
  onTableNameChange?: (tableName: string | undefined) => void;
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
  settings?: BlockSettingsComponent;
  /** True when the renderer places host header actions in its own header. */
  hasOwnHeaderActions?: boolean;
  createNode?: (
    blockId: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => Record<string, unknown>;
};

type BlockDocumentStatefulBlockRendererContextValue = {
  renderers: BlockDocumentStatefulBlockRenderers;
  blockTypes: BlockDocumentStatefulBlockType[];
  /** Host renderer for per-block header actions, such as Ask AI. */
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
    /** Provides host-rendered header actions to stateful block renderers. */
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

/** Returns the host-provided renderer for block header actions, when configured. */
export function useBlockDocumentRenderBlockHeaderActions() {
  return useContext(BlockDocumentStatefulBlockRendererContext)
    .renderBlockHeaderActions;
}

export function useBlockDocumentStatefulBlockSettings(blockType: string) {
  return useBlockDocumentStatefulBlockTypes().find(
    (candidate) => candidate.blockType === blockType,
  )?.settings;
}
