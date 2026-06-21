/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  ArtifactMetadata,
  ArtifactsSliceConfig,
  ArtifactType,
} from './ArtifactsSliceConfig';
export type {
  ArtifactMetadata as ArtifactMetadataType,
  ArtifactsSliceConfig as ArtifactsSliceConfigType,
  ArtifactType as ArtifactTypeType,
} from './ArtifactsSliceConfig';

export {
  createArtifactTypeFromStatefulBlock,
  defineArtifactTypes,
} from './ArtifactTypes';
export type {
  ArtifactLifecycleContext,
  ArtifactRenameLifecycleContext,
  ArtifactTypeDefinition,
  ArtifactTypeDefinitions,
} from './ArtifactTypes';

export {
  createArtifactsSlice,
  useStoreWithArtifacts,
  useStoreWithArtifactsAndLayout,
} from './ArtifactsSlice';
export type {
  ArtifactsSliceState,
  CreateArtifactsSliceProps,
  RoomStateWithArtifacts,
  RoomStateWithArtifactsAndLayout,
} from './ArtifactsSlice';

export {useArtifactWorkspace} from './artifactWorkspace';
export type {
  ArtifactWorkspaceDescriptor,
  ArtifactWorkspaceSelectFallback,
  UseArtifactWorkspaceOptions,
  UseArtifactWorkspaceResult,
} from './artifactWorkspace';

export {
  ArtifactTabs,
  createArtifactLayoutNode,
  createArtifactPanelDefinition,
  useArtifactTabs,
} from './artifactTabs';
export type {
  ArtifactTabDescriptor,
  ArtifactTabsProps,
  UseArtifactTabsOptions,
  UseArtifactTabsResult,
} from './artifactTabs';
