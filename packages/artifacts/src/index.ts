/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  ArtifactEntry,
  ArtifactsSliceConfig,
  ArtifactType,
} from './ArtifactsSliceConfig';
export type {
  ArtifactEntry as ArtifactEntryType,
  ArtifactsSliceConfig as ArtifactsSliceConfigType,
  ArtifactType as ArtifactTypeType,
} from './ArtifactsSliceConfig';

export {createArtifactsSlice, useStoreWithArtifacts} from './ArtifactsSlice';
export type {
  ArtifactsSliceState,
  CreateArtifactsSliceProps,
} from './ArtifactsSlice';
