/**
 * React-free entry point for the artifact data model.
 *
 * The package root re-exports slices and components and therefore pulls in
 * React, so a consumer that only needs the serializable shapes — a test runner,
 * a migration script, a server-side tool — previously had to reach into
 * `src/…` internals. That is brittle: these types have already moved between
 * modules once, silently breaking importers that had reached in.
 *
 * This entry is that stable, dependency-light surface. It must not import
 * anything beyond zod and sibling schema modules.
 *
 * Resolution is the same as every other entry in this package: the build
 * targets bundlers and transpilers (`moduleResolution: "bundler"`), so emitted
 * re-exports are extensionless and native Node ESM cannot resolve them
 * directly. Being React-free is what makes this entry usable from Node
 * toolchains; making the whole package resolvable by bare `node` is a separate,
 * package-wide build question.
 */
export {
  ArtifactMetadata,
  ArtifactsSliceConfig,
  ArtifactType,
} from './ArtifactsSliceConfig';
/**
 * Type-only aliases. Each schema above is exported as both a value and a type
 * under one name; these `*Type` aliases let a consumer name the inferred type
 * without importing the runtime schema.
 */
export type {
  ArtifactMetadata as ArtifactMetadataType,
  ArtifactsSliceConfig as ArtifactsSliceConfigType,
  ArtifactType as ArtifactTypeType,
} from './ArtifactsSliceConfig';

export {ArtifactSessionLinkSchema} from './ai/ArtifactSessionLink';
export type {ArtifactSessionLink} from './ai/ArtifactSessionLink';
