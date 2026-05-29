# Root Block Artifacts

## Todo Checklist

- [ ] [Stage 1: Shared Vocabulary and Invariants](#stage-1-shared-vocabulary-and-invariants)
- [ ] [Stage 2: Root Block Metadata Alias Layer](#stage-2-root-block-metadata-alias-layer)
- [ ] [Stage 3: Root Block Registry Facade](#stage-3-root-block-registry-facade)
- [ ] [Stage 4: Block Embed Integration](#stage-4-block-embed-integration)
- [ ] [Stage 5: AI and Command Vocabulary](#stage-5-ai-and-command-vocabulary)
- [ ] [Stage 6: Package Boundary Evaluation](#stage-6-package-boundary-evaluation)
- [ ] [Stage 7: Optional Package Promotion](#stage-7-optional-package-promotion)
- [ ] [Stage 8: Deprecation Path](#stage-8-deprecation-path)

## Goal

Explore and gradually implement a model where SQLRooms artifacts are represented
as root blocks, reducing the conceptual split between workspace resources and
document-composable blocks.

The target mental model:

```txt
Block
  - inline/content block: paragraph, image, chart, embed
  - root/resource block: dashboard, document, blocks document, notebook
```

In this model, the current `@sqlrooms/artifacts` package becomes either:

- a compatibility layer over root block metadata, or
- a root block registry that may eventually be renamed or promoted into a
  broader blocks package.

## Non-Goals

- Do not replace the current artifacts package in one step.
- Do not migrate persisted room state before the new model is proven.
- Do not inline dashboard, document, notebook, or app state into document blocks.
- Do not require every block to be independently openable as a workspace tab.
- Do not break existing artifact type definitions, layout integration, or AI
  context tools during the transition.
- Do not rename user-facing CLI concepts like `Analysis` unless the product
  vocabulary changes separately.

## Current Architecture Findings

### Artifacts

- `@sqlrooms/artifacts` owns addressable workspace resources.
- `ArtifactMetadata` already looks like root block metadata:
  `{id, type, title, visibility, parentArtifactId}`.
- `ArtifactVisibility` supports `workspace` and `embedded`, which maps well to
  root blocks that can either appear as tabs or live under another block/root.
- `createArtifactsSlice` owns creation, ensure, rename, close, delete, current
  selection, ordering, and type validation.
- `ArtifactTypeDefinition` connects metadata to runtime behavior through
  `label`, `defaultTitle`, `icon`, `component`, and lifecycle hooks.
- `artifactTabs.tsx` connects artifacts to layout panels and tab state.
- `@sqlrooms/artifacts/ai` exposes artifact context tools and depends on
  host-provided payload readers.

### Blocks Documents

- `@sqlrooms/documents` owns `BlocksDocument` state and Tiptap block rendering.
- Blocks document content already has custom block nodes for charts, images, and
  artifact embeds.
- `artifactEmbed` blocks currently reference artifact metadata by
  `{artifactId, artifactType}`.
- Embedded dashboards are currently modeled as artifacts with
  `visibility: 'embedded'` and `parentArtifactId` set to the owning blocks
  document id.
- This is already close to "embed block references a root block."

### Dashboards and Other Resource Types

- Dashboards, notebooks, documents, generated apps, and similar features have
  their own backing slices keyed by artifact id.
- Dashboard runtime state depends on stable resource ids for chart runtime keys
  and selections.
- A root block model should preserve this separate backing state instead of
  trying to store everything inside a parent document tree.

## Proposed Implementation Approach

Treat artifacts as root blocks first at the type/API layer, then decide whether
the package boundary should change after the model has worked across one or two
real consumers.

The lowest-risk path is:

1. Introduce root block vocabulary as aliases and helpers.
2. Add a facade that exposes artifact operations as root block operations.
3. Teach blocks document embeds to speak in root block terms while still using
   existing artifact metadata underneath.
4. Update AI and command vocabulary to describe root blocks where useful.
5. Reassess package naming once the model is stable.

This keeps the existing workspace lifecycle intact while making the conceptual
model converge.

## Stages

### Stage 1: Shared Vocabulary and Invariants

Document the semantic distinction between regular blocks and root blocks.

Implementation notes:

- Add architecture notes explaining:
  - root blocks are addressable resources
  - inline blocks are document/content nodes
  - embed blocks reference root blocks by id
  - backing state remains owned by feature slices
- Define invariants:
  - every root block has stable `id`, `type`, and display title
  - root blocks may be `workspace` or `embedded`
  - embedded root blocks have a parent root/block relationship
  - root block delete runs lifecycle cleanup
  - embed blocks do not own the embedded resource state

Acceptance criteria:

- A doc describes the target model and how it maps to current artifacts.
- The doc explicitly states that dashboards remain independently keyed
  resources even when embedded.
- No code behavior changes.

Likely files/modules:

- `contributing/architecture.md`
- `dev-docs/tasks/root-block-artifacts.md`
- Possibly package README files for `@sqlrooms/artifacts` and
  `@sqlrooms/documents`

Tests/checks:

- Documentation-only review.
- `pnpm format` if markdown formatting is touched broadly.

### Stage 2: Root Block Metadata Alias Layer

Add type aliases and helper names that present `ArtifactMetadata` as root block
metadata without changing persisted state.

Implementation notes:

- Add exported aliases such as:

```ts
export const RootBlockMetadata = ArtifactMetadata;
export type RootBlockMetadata = ArtifactMetadata;
export const RootBlockVisibility = ArtifactVisibility;
export type RootBlockVisibility = ArtifactVisibility;
```

- Consider adding non-persisted helper terminology:
  - `parentRootBlockId` as an API alias for `parentArtifactId`
  - `isRootBlockVisibleInWorkspace`
  - `isEmbeddedRootBlock`
- Keep serialized config shape unchanged.

Acceptance criteria:

- Existing artifact APIs remain unchanged.
- New root block metadata exports are available from the package.
- No persisted state migration is required.
- Tests prove aliases parse the same values as artifact metadata.

Likely files/modules:

- `packages/artifacts/src/ArtifactsSliceConfig.ts`
- `packages/artifacts/src/index.ts`
- `packages/artifacts/README.md`
- Existing artifacts tests, or new tests if the package has none yet

Tests/checks:

- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts build`
- `pnpm --filter @sqlrooms/artifacts lint`

### Stage 3: Root Block Registry Facade

Add a root block facade over the existing artifacts slice.

Implementation notes:

- Keep the underlying state key as `artifacts` for compatibility.
- Add helper APIs that can be adopted by new code:
  - `createRootBlock`
  - `ensureRootBlock`
  - `renameRootBlock`
  - `deleteRootBlock`
  - `setCurrentRootBlock`
  - `getRootBlock`
- Add type definition aliases:
  - `RootBlockTypeDefinition`
  - `RootBlockTypeDefinitions`
  - `defineRootBlockTypes`
  - lifecycle context aliases
- Decide whether the facade lives in `@sqlrooms/artifacts` first or a new
  internal module that can move later.

Acceptance criteria:

- New code can use root block names without importing artifact-specific names.
- Existing artifact APIs and call sites continue to work.
- Facade methods delegate to the exact same lifecycle hooks and state updates.
- No duplicate state systems are introduced.

Likely files/modules:

- `packages/artifacts/src/ArtifactsSlice.ts`
- `packages/artifacts/src/ArtifactTypes.ts`
- `packages/artifacts/src/index.ts`
- `packages/artifacts/README.md`

Tests/checks:

- Unit tests for facade methods matching artifact behavior.
- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/artifacts lint`
- `pnpm build`

### Stage 4: Block Embed Integration

Make blocks document embed APIs refer to root blocks while preserving artifact
compatibility.

Implementation notes:

- Add root-block-oriented names beside current embed names:
  - `BlocksDocumentRootBlockEmbedBlock`
  - `rootBlockId`
  - `rootBlockType`
- Keep backward-compatible parsing from `{artifactId, artifactType}` while new
  commands and docs prefer root block terms.
- Update embed renderer props to support root block names:

```ts
type BlocksDocumentRootBlockEmbedRendererProps = {
  parentRootBlockId: string;
  blockId: string;
  rootBlockId: string;
  rootBlockType: string;
  caption?: string;
};
```

- Consider whether Tiptap node attrs should rename immediately or support both
  for one transition window.

Acceptance criteria:

- Existing dashboard embeds continue to render.
- New embeds can be created using root block terminology.
- AI/command DTOs can describe embed targets as root blocks.
- Tests cover old and new attribute names if compatibility is retained.

Likely files/modules:

- `packages/documents/src/BlocksDocumentSliceConfig.ts`
- `packages/documents/src/BlocksDocumentEmbedRendererContext.tsx`
- `packages/documents/src/BlocksDocumentEditor/extensions/*`
- `packages/documents/src/BlocksDocumentEditor/node-views/*`
- `packages/documents/src/BlocksDocumentCommands.ts`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisDashboardEmbedRenderer.tsx`

Tests/checks:

- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents lint`
- `pnpm --filter sqlrooms-cli-app typecheck`
- Manual browser check: create an Analysis, insert dashboard embed, verify it
  renders independently.

### Stage 5: AI and Command Vocabulary

Align assistant-facing tools with root block terminology.

Implementation notes:

- Add root block aliases for artifact context tools:
  - `list_context_root_blocks`
  - `read_context_root_block`
  - `set_primary_context_root_block`
- Keep existing artifact tool names initially to avoid breaking assistant
  prompts.
- Update blocks document authoring instructions:
  - "embed dashboard artifact" becomes "embed dashboard root block"
  - standalone chart blocks remain ordinary content blocks
  - dashboard embeds remain independent root blocks
- Consider command IDs carefully. Avoid churn unless there is clear value.

Acceptance criteria:

- AI instructions consistently explain root blocks versus content blocks.
- Existing AI behavior still works with artifact tool names.
- New helpers can be introduced without duplicate implementations.

Likely files/modules:

- `packages/artifacts/src/ai.ts`
- `packages/documents/src/BlocksDocumentAi.ts`
- `packages/documents/src/BlocksDocumentCommands.ts`
- `apps/sqlrooms-cli-ui/src/createArtifactContextAiTools.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`

Tests/checks:

- AI helper unit tests for generated instructions/tool names.
- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter sqlrooms-cli-app typecheck`

### Stage 6: Package Boundary Evaluation

Decide whether root block APIs should remain in `@sqlrooms/artifacts`, move to
`@sqlrooms/blocks`, or create a new package with a compatibility export.

Evaluation questions:

- Is `@sqlrooms/artifacts` still the clearest package name once root block
  vocabulary lands?
- Do ordinary document blocks belong in the same package as root block registry
  APIs?
- Would `@sqlrooms/blocks` become too broad if it includes both Tiptap block
  nodes and workspace resource registry?
- Does a better split exist?
  - `@sqlrooms/root-blocks` for resource registry
  - `@sqlrooms/blocks` for reusable content block schemas/components
  - `@sqlrooms/documents` for document artifact implementations

Recommended default:

- Keep root block registry APIs in `@sqlrooms/artifacts` for the first pass.
- Promote ordinary reusable block schemas/components only after at least one
  non-document package wants to consume them.
- Defer package rename until public API pressure justifies it.

Acceptance criteria:

- A short ADR or task note records the package boundary decision.
- The decision includes migration cost and import churn.
- No package rename occurs without an explicit follow-up stage.

Likely files/modules:

- `dev-docs/tasks/root-block-artifacts.md`
- `docs/adr/*` if ADRs are used for package boundaries
- Package READMEs

Tests/checks:

- Documentation review.
- No runtime checks required unless code is moved.

### Stage 7: Optional Package Promotion

If Stage 6 concludes that promotion is worthwhile, introduce the new package
boundary in a small compatibility-preserving step.

Implementation notes:

- Possible package names:
  - `@sqlrooms/root-blocks` for registry/lifecycle/tab concepts
  - `@sqlrooms/blocks` for generic block schemas and content composition
- Prefer re-exporting from the old package before moving all internals.
- Update a small number of internal call sites first.
- Keep examples and CLI on compatibility imports until the package proves
  stable.

Acceptance criteria:

- New package builds and exports the chosen root block API.
- Old `@sqlrooms/artifacts` imports still work.
- No duplicated registry implementation exists.
- Package README explains the relationship between old and new names.

Likely files/modules:

- `packages/root-blocks/*` or `packages/blocks/*`
- `packages/artifacts/src/index.ts`
- `pnpm-workspace.yaml`
- `turbo.json` if package tasks need explicit updates
- Internal package READMEs

Tests/checks:

- `pnpm install` if workspace metadata changes require lockfile updates.
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- Focused package tests for affected packages.

### Stage 8: Deprecation Path

Only after the root block model is established, decide whether to deprecate the
artifact vocabulary.

Implementation notes:

- Add deprecation comments to old type names only after replacement APIs are
  documented and used internally.
- Avoid warning spam in downstream apps.
- Provide a migration guide:
  - `ArtifactMetadata` -> `RootBlockMetadata`
  - `ArtifactTypeDefinition` -> `RootBlockTypeDefinition`
  - `createArtifact` -> `createRootBlock`
  - `artifactEmbed` -> root block embed terminology if adopted
- Deprecate docs first, types later.

Acceptance criteria:

- Internal call sites mostly use the new root block vocabulary.
- Existing apps can migrate gradually.
- Release notes include the migration table.
- No runtime behavior changes are bundled with deprecation annotations.

Likely files/modules:

- `packages/artifacts/README.md`
- `packages/documents/README.md`
- Package source JSDoc comments
- Release notes or changelog if present

Tests/checks:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- Example app smoke checks where artifact/root block APIs are used.

## Risks and Open Questions

- `Block` may become too overloaded if it means both a paragraph and a
  dashboard. The naming must make the root/content distinction obvious.
- Notion's model is elegant, but SQLRooms has analytics-specific lifecycle and
  runtime concerns. We should preserve independently keyed resource state.
- A package rename could create large import churn with little immediate user
  value.
- It is unclear whether `parentArtifactId` should become `parentRootBlockId`,
  `parentBlockId`, or remain as persisted compatibility field with API aliases.
- Layout tabs currently assume artifact ids. Root block APIs should not require
  layout state to understand arbitrary document content blocks.
- AI tools may become confusing if both artifact and root block terms are
  visible at once. The transition language needs care.
- Embedded resources may need richer parent relationships than a single parent
  id if the same dashboard can be embedded in multiple documents.
- CRDT mirrors currently sync document/artifact metadata together in package-
  specific ways; root block metadata may deserve its own mirror later.

## Progress Log

- 2026-05-29: Created staged plan for evolving artifacts toward root blocks.
