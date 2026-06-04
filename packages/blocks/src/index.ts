/**
 * Shared block contracts for SQLRooms packages.
 *
 * This package owns vocabulary and type shapes only. Concrete block
 * implementations remain in the feature packages that own their state.
 *
 * @packageDocumentation
 */

import type {ComponentType} from 'react';

export type BlockId = string;
export type BlockType = string;

export type BlockInstance<
  TAttrs extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: BlockId;
  type: BlockType;
  title?: string;
  attrs?: TAttrs;
};

export type BlockCapability =
  | 'stateful'
  | 'selectable'
  | 'embeddable'
  | 'executable'
  | 'participatesInDag'
  | 'producesRelation'
  | 'consumesRelation'
  | 'hasRuntimeCache';

export type BlockCapabilities = Partial<Record<BlockCapability, true>>;

export type BlockOwnership = 'owned' | 'shared' | 'external';

export type BlockReference = {
  blockInstanceId: BlockId;
  blockType: BlockType;
  ownership?: BlockOwnership;
};

export type OrderedBlockContainer = {
  blockIds: BlockId[];
};

export type GraphBlockEdgeKind = 'dependency' | 'manual' | (string & {});

export type GraphBlockEdge = {
  id: string;
  source: BlockId;
  target: BlockId;
  kind?: GraphBlockEdgeKind;
};

export type GraphBlockContainer = OrderedBlockContainer & {
  edges: GraphBlockEdge[];
};

export type StatefulBlockContext<TRoomState = unknown> = {
  blockId: BlockId;
  blockType: BlockType;
  title?: string;
  attrs?: Record<string, unknown>;
  getState: () => TRoomState;
};

export type StatefulBlockRenameContext<TRoomState = unknown> =
  StatefulBlockContext<TRoomState> & {
    previousTitle: string;
    title: string;
  };

export type StatefulBlockRenderProps<TRoomState = unknown> = {
  blockId: BlockId;
  blockType: BlockType;
  title?: string;
  attrs?: Record<string, unknown>;
  readOnly?: boolean;
  getState?: () => TRoomState;
};

export type StatefulBlockDefinition<TRoomState = unknown> = {
  type: BlockType;
  label: string;
  defaultTitle?: string;
  icon?: ComponentType<{className?: string}>;
  capabilities?: BlockCapabilities;
  createInstance?: (context: StatefulBlockContext<TRoomState>) => BlockInstance;
  ensureState?: (context: StatefulBlockContext<TRoomState>) => void;
  deleteState?: (context: StatefulBlockContext<TRoomState>) => void;
  rename?: (context: StatefulBlockRenameContext<TRoomState>) => void;
  close?: (context: StatefulBlockContext<TRoomState>) => void;
  render: ComponentType<StatefulBlockRenderProps<TRoomState>>;
};
