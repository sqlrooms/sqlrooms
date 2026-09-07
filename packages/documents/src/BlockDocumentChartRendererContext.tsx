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
  /** Optional host-provided actions rendered in the chart block header. */
  headerActions?: ReactNode;
};

export type BlockDocumentChartRenderer = FC<BlockDocumentChartRendererProps>;

/** Identifying context passed to {@link BlockDocumentBlockFrameClassNameGetter}. */
export type BlockDocumentBlockFrameContext = {
  blockDocumentId: string;
  blockId: string;
  blockType: string;
  /** Whether the block is the active TipTap node selection. */
  selected: boolean;
};

/**
 * Optional host function returning extra classes for a chart block's outer frame
 * (the `NodeViewWrapper`), letting the host recolor the block's border/outline
 * from its own state (e.g. an in-progress AI edit). Returned classes are merged
 * last, so they win over the built-in border/selection outline.
 *
 * This is a plain (pure) function, not a hook: the host owns any reactive
 * subscription and passes a fresh function when the result should change.
 */
export type BlockDocumentBlockFrameClassNameGetter = (
  ctx: BlockDocumentBlockFrameContext,
) => string | undefined;

type BlockDocumentChartRendererContextValue = {
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
  renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
  getBlockFrameClassName?: BlockDocumentBlockFrameClassNameGetter;
};

const BlockDocumentChartRendererContext =
  createContext<BlockDocumentChartRendererContextValue>({});

/** Props for providing a chart renderer to block document chart node views. */
export type BlockDocumentChartRendererProviderProps = PropsWithChildren<{
  renderer?: BlockDocumentChartRenderer;
  settings?: BlockSettingsComponent;
  renderBlockHeaderActions?: BlockDocumentBlockHeaderActionsRenderer;
  getBlockFrameClassName?: BlockDocumentBlockFrameClassNameGetter;
}>;

/** Provides the chart renderer used by block document chart node views. */
export const BlockDocumentChartRendererProvider: FC<
  BlockDocumentChartRendererProviderProps
> = ({
  renderer,
  settings,
  renderBlockHeaderActions,
  getBlockFrameClassName,
  children,
}) => {
  const contextValue = useMemo(
    () => ({
      renderer,
      settings,
      renderBlockHeaderActions,
      getBlockFrameClassName,
    }),
    [renderer, settings, renderBlockHeaderActions, getBlockFrameClassName],
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

/**
 * Returns the host-provided {@link BlockDocumentBlockFrameClassNameGetter} from
 * the chart renderer context, or `undefined` when the host has not configured
 * one. Callers should treat `undefined` as "no extra frame classes".
 */
export function useBlockDocumentChartGetBlockFrameClassName() {
  return useContext(BlockDocumentChartRendererContext).getBlockFrameClassName;
}
