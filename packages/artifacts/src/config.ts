/**
 * React-free entry point for the artifact data model.
 *
 * The package root re-exports slices and components and therefore pulls in
 * React, so a Node consumer that only needs the serializable shapes — a test
 * runner, a migration script, a server-side tool — has to either parse the ESM
 * build or reach into `src/…` internals. Reaching in is brittle: these types
 * have already moved between modules once, silently breaking importers.
 *
 * This entry is that stable, dependency-light surface. It must not import
 * anything beyond zod and sibling schema modules.
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

export {ArtifactSessionLinkSchema} from './ai/ArtifactSessionLink';
export type {ArtifactSessionLink} from './ai/ArtifactSessionLink';
