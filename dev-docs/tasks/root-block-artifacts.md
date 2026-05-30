# Root Resources and Block Embeds

Status: superseded by `dev-docs/tasks/stateful-blocks-artifact-shells.md`.
The current decision is to keep artifacts as workspace shells, use direct
stateful blocks inside block documents, and not reintroduce artifact embed
blocks unless a future explicit reference-block design is needed.

## Archival Note

See `dev-docs/tasks/stateful-blocks-artifact-shells.md` for the current plan.
This document is retained only for historical context and should not be used as
an active task checklist.

## Goal

Clarify the relationship between artifacts, blocks, and embedded resources
without prematurely replacing `@sqlrooms/artifacts`.

The useful conceptual bridge is:

```txt
Artifact / root resource = addressable thing with lifecycle
Block = composable content node
Embed block = reference to an artifact/root resource
Cell = executable block inside a notebook/root resource
```

The "root block" idea is still valuable as internal architecture language: it
explains why a dashboard, notebook, document, or block document can be embedded
inside another document while keeping independent state and lifecycle.

However, the public/package term `artifact` is still useful today. It describes
the current registry, tab/layout integration, current selection, lifecycle
hooks, and AI context tools better than the overloaded word `block`.

## Non-Goals

- Do not deprecate `@sqlrooms/artifacts` as part of this plan.
- Do not rename the artifacts package in the near term.
- Do not migrate persisted room state.
- Do not inline dashboard, notebook, document, or app state into document
  blocks.
- Do not require every block to be independently openable as a workspace tab.
- Do not make "block" the public name for every concept in the framework.
- Do not rename user-facing CLI concepts like `Analysis` unless the product
  vocabulary changes separately.

## Current Architecture Findings

### Artifacts / Resources

- `@sqlrooms/artifacts` owns addressable workspace resources.
- `ArtifactMetadata` is already close to root-resource metadata:
  `{id, type, title, visibility, parentArtifactId}`.
- `ArtifactVisibility` supports `workspace` and `embedded`, which maps well to
  resources that either appear as tabs or live under another resource.
- `createArtifactsSlice` owns creation, ensure, rename, close, delete, current
  selection, ordering, and type validation.
- `ArtifactTypeDefinition` connects metadata to runtime behavior through
  `label`, `defaultTitle`, `icon`, `component`, and lifecycle hooks.
- `artifactTabs.tsx` connects artifacts to layout panels and tab state.
- `@sqlrooms/artifacts/ai` exposes context tools and depends on host-provided
  payload readers.

### Block Documents

- `@sqlrooms/documents` owns `BlockDocument` state and Tiptap block rendering.
- Block document content has content blocks for text, images, charts, and
  embeds.
- Embed blocks currently reference artifact metadata by
  `{artifactId, artifactType}`.
- Embedded dashboards are artifacts with `visibility: 'embedded'` and
  `parentArtifactId` set to the owning block document id.
- This is already the practical model we want: an embed block references an
  addressable resource by id.

### Cells and Notebooks

- See `dev-docs/tasks/cells-blocks-convergence.md`.
- Cells are best understood as executable blocks inside a notebook resource.
- Notebook DAG state should remain notebook-owned, not folded into
  `BlockDocument`.

## Proposed Approach

Keep `@sqlrooms/artifacts` as the resource registry for now. Use "root block" as
architecture language where it clarifies relationships, but prefer "artifact" or
"resource" in public APIs unless a new abstraction has proven itself.

The near-term value is:

1. Make the model explicit in docs.
2. Add small aliases/helpers only where they reduce confusion.
3. Improve block embed terminology so embeds read as references to resources.
4. Align AI/command language with the user's mental model.
5. Record the package-boundary decision instead of drifting into rename churn.

Package promotion, package renaming, and artifact deprecation are deliberately
parked as follow-up decisions, not implementation stages.

## Stages

### Stage 1: Vocabulary and Invariants

Document the semantic distinction between resources and blocks.

Implementation notes:

- Add architecture notes explaining:
  - artifacts/resources are addressable objects with lifecycle
  - content blocks are document nodes
  - executable blocks are notebook cells
  - embed blocks reference resources by id
  - backing state remains owned by feature slices
- Define invariants:
  - every resource has stable `id`, `type`, and display title
  - resources may be `workspace` or `embedded`
  - embedded resources may have a parent resource relationship
  - resource delete runs lifecycle cleanup
  - embed blocks do not own the embedded resource state

Acceptance criteria:

- A doc describes the target model and how it maps to current artifacts.
- The doc explicitly states that dashboards and notebooks remain independently
  keyed resources even when embedded.
- No code behavior changes.

Likely files/modules:

- `contributing/architecture.md`
- `dev-docs/tasks/root-block-artifacts.md`
- Possibly `packages/artifacts/README.md`
- Possibly `packages/documents/README.md`

Tests/checks:

- Documentation-only review.
- `pnpm format` if markdown formatting is touched broadly.

### Stage 2: Resource Metadata Alias Exploration

Evaluate whether lightweight resource/root-resource aliases make the current
artifact metadata easier to use.

Implementation notes:

- Consider exported aliases such as:

```ts
export const ResourceMetadata = ArtifactMetadata;
export type ResourceMetadata = ArtifactMetadata;
export const ResourceVisibility = ArtifactVisibility;
export type ResourceVisibility = ArtifactVisibility;
```

- Consider helper functions rather than new state:
  - `isWorkspaceResource`
  - `isEmbeddedResource`
  - `getParentResourceId`
- Avoid `RootBlockMetadata` as a public name unless the team decides "root
  block" should be exposed beyond architecture docs.
- Keep serialized config shape unchanged.

Acceptance criteria:

- A small spike decides whether aliases improve clarity.
- Existing artifact APIs remain unchanged.
- No persisted state migration is required.
- If aliases are added, tests prove they parse/represent the same values as
  artifact metadata.

Likely files/modules:

- `packages/artifacts/src/ArtifactsSliceConfig.ts`
- `packages/artifacts/src/helpers.ts`
- `packages/artifacts/src/index.ts`
- `packages/artifacts/README.md`

Tests/checks:

- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts build`
- `pnpm --filter @sqlrooms/artifacts lint`

### Stage 3: Resource Registry Facade Spike

Evaluate whether a small resource-named facade over the artifacts slice reduces
conceptual load for new code.

Implementation notes:

- Keep the underlying state key as `artifacts`.
- Consider helper names such as:
  - `createResource`
  - `ensureResource`
  - `renameResource`
  - `deleteResource`
  - `setCurrentResource`
  - `getResource`
- Consider type aliases:
  - `ResourceTypeDefinition`
  - `ResourceTypeDefinitions`
  - `defineResourceTypes`
  - lifecycle context aliases
- Treat this as a spike. If the facade duplicates too much or makes imports
  noisier, record that and stop.

Acceptance criteria:

- A decision is made on whether resource-named helpers are worth keeping.
- Any kept helpers delegate to the existing artifacts slice and lifecycle hooks.
- Existing artifact APIs and call sites continue to work.
- No duplicate registry implementation is introduced.

Likely files/modules:

- `packages/artifacts/src/ArtifactsSlice.ts`
- `packages/artifacts/src/ArtifactTypes.ts`
- `packages/artifacts/src/index.ts`
- `packages/artifacts/README.md`

Tests/checks:

- Unit tests for kept facade methods, if any.
- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/artifacts lint`
- `pnpm build`

### Stage 4: Block Embed Resource Vocabulary

Improve block document embed terminology so it is clear that embeds reference
resources/artifacts instead of owning inline state.

Implementation notes:

- Prefer "resource embed" in docs and user-facing explanations.
- Decide whether schema/API names should stay as `artifactEmbed` or gain aliases
  such as:
  - `resourceEmbed`
  - `resourceId`
  - `resourceType`
- Keep backward-compatible parsing from `{artifactId, artifactType}` if new DTO
  names are introduced.
- Do not rename persisted Tiptap attrs unless the benefit outweighs migration
  and compatibility cost.

Acceptance criteria:

- Existing dashboard embeds continue to render.
- Docs explain embed blocks as resource references.
- New command/AI DTOs can use resource terminology if the naming proves clearer.
- Tests cover old and new attribute names if compatibility aliases are added.

Likely files/modules:

- `packages/documents/src/BlockDocumentSliceConfig.ts`
- `packages/documents/src/BlockDocumentEmbedRendererContext.tsx`
- `packages/documents/src/BlockDocumentCommands.ts`
- `packages/documents/src/BlockDocumentAi.ts`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisDashboardEmbedRenderer.tsx`

Tests/checks:

- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents lint`
- `pnpm --filter sqlrooms-cli-app typecheck`
- Manual browser check: create an Analysis, insert dashboard embed, verify it
  renders independently.

### Stage 5: AI and Command Vocabulary Cleanup

Align assistant-facing language with the resource/block distinction.

Implementation notes:

- Keep existing artifact tool names initially unless there is a clear migration
  reason.
- Update prompt/instruction language:
  - "artifact/resource" for addressable workspace things
  - "block" for content nodes
  - "embed block" for references to resources
  - "cell" or "executable block" for notebook DAG nodes
- Avoid exposing artifact, resource, root block, block, and cell terms all at
  once in user-facing prompts.

Acceptance criteria:

- AI instructions consistently explain resources versus content blocks.
- Existing AI behavior still works.
- New aliases, if any, share implementations with current artifact tools.

Likely files/modules:

- `packages/artifacts/src/ai.ts`
- `packages/documents/src/BlockDocumentAi.ts`
- `packages/documents/src/BlockDocumentCommands.ts`
- `apps/sqlrooms-cli-ui/src/createArtifactContextAiTools.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`

Tests/checks:

- AI helper unit tests for generated instructions/tool names.
- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter sqlrooms-cli-app typecheck`

### Stage 6: Decision Record and Follow-Up Parking Lot

Record whether package or API renames are worth pursuing after the low-risk
vocabulary work.

Decision questions:

- Is `artifact` still the clearest public API term?
- Would `resource` be clearer than `artifact` for new APIs?
- Should "root block" remain internal architecture language only?
- Are document blocks, executable cells, and resource registry concepts too
  different for one package named `@sqlrooms/blocks`?
- Is import churn justified by actual simplification?

Recommended default:

- Keep `@sqlrooms/artifacts` as the package name.
- Use `resource` as explanatory language where it helps.
- Keep `root block` as a design concept unless future work proves it should be
  public.
- Do not deprecate artifacts yet.

Acceptance criteria:

- A short note records the decision.
- Any deferred package rename/deprecation work is listed as follow-up, not
  active implementation.
- The decision cites concrete costs and benefits.

Likely files/modules:

- `dev-docs/tasks/root-block-artifacts.md`
- `docs/adr/*` if ADRs are used for package boundaries
- Package READMEs

Tests/checks:

- Documentation review.

## Deferred Follow-Ups

These are intentionally not part of the active checklist.

### Package Boundary Evaluation

Possible future package splits:

- `@sqlrooms/artifacts` remains the resource registry.
- `@sqlrooms/resources` becomes a compatibility-preserving rename if the term
  proves clearer.
- `@sqlrooms/blocks` contains reusable content block schemas/components only.
- `@sqlrooms/cells` continues to own executable DAG blocks.

### Optional Package Promotion

Only consider a new package if multiple packages need the same concrete block or
resource primitives and re-exporting is no longer enough.

### Deprecation Path

Only consider deprecating artifact vocabulary after replacement APIs are stable,
documented, and adopted internally. Deprecate docs first, types later.

## Risks and Open Questions

- `Block` is already overloaded by content blocks, executable cell blocks, and
  conceptual root blocks.
- Replacing `artifact` with `block` may reduce one concept while blurring three
  others.
- `resource` may be clearer than `root block` for public APIs.
- SQLRooms has analytics-specific lifecycle and runtime concerns that Notion's
  "everything is a block" model does not need to expose.
- Package renames can create large import churn with little immediate user
  value.
- It is unclear whether `parentArtifactId` should remain as-is, gain
  `parentResourceId` aliases, or migrate later.
- Layout tabs currently assume artifact ids. Resource/block vocabulary should
  not require layout state to understand arbitrary document content blocks.
- Embedded resources may need richer parent relationships than a single parent
  id if the same dashboard or notebook can be embedded in multiple documents.
- AI prompts may become confusing if they expose too many ontology terms at
  once.

## Progress Log

- 2026-05-29: Created staged plan for evolving artifacts toward root blocks.
- 2026-05-29: Reframed plan around root resources and block embeds; package
  promotion and artifact deprecation moved to deferred follow-ups.
