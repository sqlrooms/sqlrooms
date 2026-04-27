import type {RoomPanelComponent} from '@sqlrooms/layout';
import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import type {ComponentType} from 'react';
import type {StoreApi} from 'zustand';
import type {ArtifactMetadata as ArtifactMetadataType} from './ArtifactsSliceConfig';

export type ArtifactLifecycleContext<
  TRoomState extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  artifactId: string;
  artifact: ArtifactMetadataType;
  store: StoreApi<TRoomState>;
};

export type ArtifactRenameLifecycleContext<
  TRoomState extends BaseRoomStoreState = BaseRoomStoreState,
> = ArtifactLifecycleContext<TRoomState> & {
  previousTitle: string;
};

/**
 * Runtime definition for one artifact type.
 *
 * Artifact type definitions are app configuration, not persisted room state.
 * They connect durable artifact metadata to UI presentation, panel rendering,
 * and artifact-specific backing state such as notebook cells, canvas documents,
 * dashboards, or generated apps.
 */
export type ArtifactTypeDefinition<
  TRoomState extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  /** Human-readable type label used in create menus and fallback titles. */
  label: string;

  /** Default title assigned when `createArtifact` or `ensureArtifact` omits one. */
  defaultTitle?: string;

  /** Icon shown in artifact tabs, menus, and search results. */
  icon?: ComponentType<{className?: string}>;

  /** Layout panel component used when this artifact is opened as a tab. */
  component?: RoomPanelComponent;

  /**
   * Runs after `createArtifact` creates a brand-new artifact registry entry.
   *
   * Use this for first-time setup, such as creating the matching dashboard,
   * canvas, notebook, or pivot state. The artifact already exists in the
   * artifacts registry when this hook runs.
   */
  onCreate?: (context: ArtifactLifecycleContext<TRoomState>) => void;

  /**
   * Runs after `ensureArtifact` has reconciled an artifact registry entry.
   *
   * This hook must be idempotent. It may run for an existing artifact, during
   * layout/tab synchronization, or while repairing persisted state. Use it to
   * ensure backing state exists and matches the artifact metadata without
   * resetting user content or applying one-time creation defaults repeatedly.
   */
  onEnsure?: (context: ArtifactLifecycleContext<TRoomState>) => void;

  /**
   * Runs after `renameArtifact` changes an artifact title.
   *
   * Use this to mirror the new title into artifact-specific persisted state.
   */
  onRename?: (context: ArtifactRenameLifecycleContext<TRoomState>) => void;

  /**
   * Runs when an artifact tab is closed or when the artifact is deleted.
   *
   * Close is non-destructive: the artifact registry entry and persisted backing
   * state remain. Use this hook for transient cleanup such as evicting runtime
   * caches, retained chart instances, or temporary selections.
   */
  onClose?: (context: ArtifactLifecycleContext<TRoomState>) => void;

  /**
   * Runs when `deleteArtifact` permanently removes an artifact.
   *
   * Use this to delete artifact-specific persisted state. `deleteArtifact` also
   * runs `onClose` before `onDelete`, so this hook does not need to repeat
   * transient runtime cleanup already handled by `onClose`.
   */
  onDelete?: (context: ArtifactLifecycleContext<TRoomState>) => void;
};

export type ArtifactTypeDefinitions<
  TRoomState extends BaseRoomStoreState = BaseRoomStoreState,
> = Record<string, ArtifactTypeDefinition<TRoomState>>;

export function defineArtifactTypes<
  const TArtifactTypes extends ArtifactTypeDefinitions<any>,
>(artifactTypes: TArtifactTypes): TArtifactTypes {
  return artifactTypes;
}
