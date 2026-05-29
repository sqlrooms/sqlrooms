# Stateful Blocks and Artifact Shells

## Todo Checklist

- [x] [Stage 1: Vocabulary and Architecture Note](#stage-1-vocabulary-and-architecture-note)
- [x] [Stage 2: Create `@sqlrooms/blocks` Contract Package](#stage-2-create-sqlroomsblocks-contract-package)
- [x] [Stage 3: Single-Block Artifact Shell Spike](#stage-3-single-block-artifact-shell-spike)
- [x] [Stage 4: Dashboard Block Adapter](#stage-4-dashboard-block-adapter)
- [x] [Stage 5: Pivot Block Adapter](#stage-5-pivot-block-adapter)
- [x] [Stage 6: Convert Current Artifact Types](#stage-6-convert-current-artifact-types)
- [x] [Stage 7: Blocks Document Stateful Block Host](#stage-7-blocks-document-stateful-block-host)
- [x] [Stage 8: Lifecycle and Ownership Semantics](#stage-8-lifecycle-and-ownership-semantics)
- [x] [Stage 9: AI and Command Integration](#stage-9-ai-and-command-integration)
- [ ] [Stage 10: Migration and Package Boundary Decision](#stage-10-migration-and-package-boundary-decision)

## Goal

Evaluate and implement a model where reusable analytical views such as
dashboards, pivot tables, notebooks, and possibly app surfaces are first-class
stateful block implementations, while artifacts/resources become addressable
workspace shells around one block or a block container.

Target model:

```txt
Block implementation
  - dashboard block
  - pivot block
  - notebook block/container
  - chart block
  - text/image/input blocks

Artifact/resource shell
  - id/title/type/lifecycle/tab/current selection
  - body: one stateful block or one block container

Blocks document
  - artifact shell whose body is a block tree/container

Notebook
  - artifact shell whose body is an executable block graph
```

This is a stronger convergence direction than "artifacts are root blocks":
artifacts remain useful as addressable shells, while blocks become the reusable
implementation units that can be embedded, wrapped, or composed.

The desired end state is one mapping source:

```ts
const ARTIFACT_TYPES = defineArtifactTypes({
  dashboard: createArtifactTypeFromStatefulBlock(dashboardBlockDefinition),
  notebook: createArtifactTypeFromStatefulBlock(notebookBlockDefinition),
  analysis: createBlocksDocumentArtifactType(blocksDocumentDefinition),
  document: createArtifactTypeFromStatefulBlock(
    markdownDocumentBlockDefinition,
  ),
  canvas: createArtifactTypeFromStatefulBlock(canvasBlockDefinition),
  app: createArtifactTypeFromStatefulBlock(appBlockDefinition),
});
```

Feature packages define stateful block behavior once. The artifact shell bridge
turns that definition into a top-level workspace resource when needed.
Blocks-document containers such as `analysis` can stay as container artifacts
when their main purpose is hosting and composing other blocks.

## Non-Goals

- Do not rewrite dashboard, pivot, notebook, or document state in one step.
- Do not make stateful blocks store all state inline inside Tiptap documents.
- Do not remove `@sqlrooms/artifacts` before single-block shells are proven.
- Do not force all blocks to share one rendering/runtime API.
- Do not make ordinary content blocks carry dashboard/pivot lifecycle concerns.
- Do not migrate persisted state until adapters and ownership rules are clear.
- Do not make embedded stateful blocks implicitly share selections or runtime
  state unless they reference the same persisted block instance by id.

## Current Architecture Findings

### Artifacts / Resources

- `@sqlrooms/artifacts` is currently the addressable shell:
  id, type, title, visibility, parent id, lifecycle hooks, tab/layout
  integration, current selection, and AI context.
- Artifact type definitions already look like shell definitions: they connect a
  durable id/title/type to a component and backing-state lifecycle hooks.
- Existing top-level artifact experiences are effectively shells around backing
  slice entries keyed by artifact id.
- Current CLI artifact types are `analysis`, `dashboard`, `notebook`,
  `document`, `canvas`, and `app`.

### Dashboards

- `@sqlrooms/mosaic` stores dashboards in
  `mosaicDashboard.config.dashboardsById`.
- Dashboard entries contain selected table, panels, layout, and timestamps.
- Dashboard runtime retains vgplot chart instances and runtime issues keyed by
  dashboard/panel ids.
- Dashboard panels are already block-like subunits with ids, types, titles, and
  configs.
- Dashboards inside blocks documents now use direct stateful block hosting
  rather than artifact embeds.

### Pivot Tables

- `@sqlrooms/pivot` stores pivots in `pivot.config.pivots`.
- A pivot item has id, title, source, config, and runtime status.
- Pivot runtime includes per-instance stores, generated relations, stale state,
  and cleanup behavior.
- Pivot cells already exist through `pivotCellRegistryEntry`, which suggests
  pivot can participate as an executable/cell-like implementation as well as a
  standalone view.

### Blocks Documents

- `@sqlrooms/documents` can host content blocks and artifact/root-resource
  embeds.
- Standalone chart blocks already reuse chart rendering/settings ideas without
  requiring a full dashboard artifact.
- The next step would be hosting stateful blocks directly, with clear lifecycle
  and ownership rules.

### Other Artifact Types

- `analysis` is a shell around `BlocksDocument` state.
- `document` is a shell around Markdown document state.
- `notebook` is a shell around notebook/cell artifact state.
- `canvas` is a shell around canvas state.
- `app` is a shell around generated app/WebContainer/project state and is likely
  the highest-risk adapter because it may involve files, previews, and runtime
  lifecycle.

## Proposed Implementation Approach

Introduce stateful block abstractions as adapters around existing backing
slices, not as a new persistence system.

The sequence should be:

1. Define vocabulary and create a tiny `@sqlrooms/blocks` contracts package.
2. Prove that an artifact can be a shell around one block implementation.
3. Adapt one existing system, preferably dashboard, as a stateful block without
   changing dashboard persistence.
4. Adapt pivot as a second system to test whether the contract handles
   generated relations and runtime status.
5. Convert current artifact type definitions to use the single bridge where
   practical, so mappings are not maintained twice.
6. Let blocks documents host stateful block instances directly.
7. Decide whether any public package/API changes are justified.

## Stages

### Stage 1: Vocabulary and Architecture Note

Document the distinction between block implementation, stateful block instance,
artifact/resource shell, and block container.

Implementation notes:

- Add architecture language:
  - block implementation: reusable renderer + schema + lifecycle adapter
  - block instance: id + type + attrs/state pointer
  - stateful block: block whose durable/runtime state lives in a feature slice
  - artifact shell: addressable workspace wrapper around one block/container
  - single-block artifact: artifact shell whose body is one stateful block
- Explain why this is different from embedding artifacts:
  - embedding artifacts references shells
  - stateful block hosting embeds/places the implementation directly
- State that existing artifacts remain the shell layer.

Acceptance criteria:

- Architecture docs describe the model and compare it to current artifact
  embeds.
- Dashboards and pivots are explicitly called out as candidates.
- No code changes.

Likely files/modules:

- `dev-docs/tasks/stateful-blocks-artifact-shells.md`
- `dev-docs/tasks/root-block-artifacts.md`
- `contributing/architecture.md`

Tests/checks:

- Documentation review.

### Stage 2: Create `@sqlrooms/blocks` Contract Package

Create a tiny package for shared block vocabulary and contracts, with feature
packages owning their concrete definitions.

Implementation notes:

- Add a new `@sqlrooms/blocks` package that exports only contracts/types and
  small type-level helpers.
- Include types such as:

```ts
type BlockInstance = {
  id: string;
  type: string;
  title?: string;
  attrs?: Record<string, unknown>;
};

type StatefulBlockDefinition<TRoomState> = {
  type: string;
  label: string;
  createInstance?: (ctx: StatefulBlockContext<TRoomState>) => BlockInstance;
  ensureState?: (ctx: StatefulBlockContext<TRoomState>) => void;
  deleteState?: (ctx: StatefulBlockContext<TRoomState>) => void;
  rename?: (ctx: StatefulBlockRenameContext<TRoomState>) => void;
  render: ComponentType<StatefulBlockRenderProps<TRoomState>>;
};
```

- Include optional capabilities rather than a monolithic interface:
  - `stateful`
  - `selectable`
  - `embeddable`
  - `executable`
  - `producesRelation`
  - `hasRuntimeCache`
- Do not move dashboard or pivot code yet.
- Do not add runtime stores, React components, dashboard/pivot/document
  implementations, or Tiptap-specific schemas.
- Default ownership:
  - `@sqlrooms/blocks` owns shared block vocabulary and contracts
  - `@sqlrooms/mosaic` exports dashboard block definitions
  - `@sqlrooms/pivot` exports pivot block definitions
  - `@sqlrooms/documents` exports document/block-document definitions
  - notebook/canvas/app packages export their own definitions
- `@sqlrooms/artifacts` should own the artifact-shell registry and the
  `createArtifactTypeFromStatefulBlock` bridge.
- Keep `@sqlrooms/blocks` small: contracts, reference/ownership types,
  capability vocabulary, and adapter helper types. Do not move dashboard, pivot,
  document, or notebook implementations into it.

Acceptance criteria:

- `@sqlrooms/blocks` package exists and builds.
- The package exports shared contracts for block instances, capabilities,
  stateful block definitions, render/lifecycle contexts, ownership/reference
  types, and host adapter types.
- The contract can describe dashboard and pivot without special cases.
- Concrete definitions live with their owning feature packages.
- No behavior changes are introduced.
- Either no feature package depends on it yet, or one small type-only adoption
  proves the import path.

Likely files/modules:

- `packages/blocks/package.json`
- `packages/blocks/src/index.ts`
- `packages/blocks/README.md`
- `pnpm-workspace.yaml` if workspace package discovery requires it
- `packages/blocks/src/*` for shared contracts and vocabulary
- `packages/artifacts/src/*` for the bridge helper
- `packages/mosaic/src/dashboard/*` for dashboard adapter type checks
- `packages/pivot/src/*` for pivot adapter type checks
- `packages/documents/src/*` for document adapter type checks

Tests/checks:

- `pnpm --filter @sqlrooms/blocks typecheck`
- `pnpm --filter @sqlrooms/blocks build`
- `pnpm --filter @sqlrooms/blocks lint`
- `pnpm build`

### Stage 3: Single-Block Artifact Shell Spike

Prototype an artifact type definition that delegates to a stateful block
definition.

Implementation notes:

- Add an adapter helper such as:

```ts
function createArtifactTypeFromStatefulBlock(definition) {
  return {
    label: definition.label,
    icon: definition.icon,
    component: definition.render,
    onCreate: definition.ensureState,
    onEnsure: definition.ensureState,
    onRename: definition.rename,
    onDelete: definition.deleteState,
  };
}
```

- Keep current artifact APIs intact.
- The shell remains responsible for id/title/type/visibility/tabs.
- The block definition owns backing state setup/render/delete behavior.

Acceptance criteria:

- A single-block shell can be defined without duplicating lifecycle code.
- Existing artifact type definitions can opt into the helper gradually.
- The helper is the intended single bridge from stateful block definitions to
  artifact type definitions.
- No persisted state changes.

Likely files/modules:

- `packages/artifacts/src/ArtifactTypes.ts`
- `packages/artifacts/src/index.ts`
- Candidate app artifact type registration

Tests/checks:

- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts test`
- App typecheck if a real artifact type adopts the helper.

### Stage 4: Dashboard Block Adapter

Represent Mosaic dashboards as a stateful block implementation while preserving
existing dashboard state.

Implementation notes:

- Add a dashboard block definition that delegates to:
  - `mosaicDashboard.ensureDashboard`
  - `mosaicDashboard.removeDashboard`
  - `mosaicDashboard.renameDashboard` or equivalent title synchronization
  - `MosaicDashboard` renderer
- Keep dashboard persistence in `mosaicDashboard.config.dashboardsById`.
- Adapt the CLI dashboard artifact type to use the single-block shell helper if
  the spike is successful.
- Do not change dashboard panel models yet.

Acceptance criteria:

- Top-level dashboard artifacts still behave the same.
- Dashboard lifecycle is expressible through the stateful block adapter.
- Embedded dashboard behavior should move from artifact embeds to direct
  stateful block hosting.
- No dashboard persisted-state migration is required.

Likely files/modules:

- `packages/mosaic/src/dashboard/*`
- `apps/sqlrooms-cli-ui/src/artifactTypes.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/dashboard/*`
- `packages/artifacts/src/*` if shell helper is used

Tests/checks:

- `pnpm --filter @sqlrooms/artifacts typecheck`
- `pnpm --filter @sqlrooms/artifacts build`
- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/artifacts lint`
- `pnpm --filter @sqlrooms/mosaic typecheck`
- `pnpm --filter @sqlrooms/mosaic build`
- `pnpm --filter @sqlrooms/mosaic lint`
- `pnpm --filter sqlrooms-cli-app typecheck`
- `pnpm --filter sqlrooms-cli-app build`
- `pnpm --filter sqlrooms-cli-app lint`
- `pnpm build`
- Manual browser check: dashboard artifact opens, charts render, delete cleanup
  still works.

### Stage 5: Pivot Block Adapter

Represent pivots as a second stateful block implementation to validate the
contract against generated relations and runtime status.

Implementation notes:

- Add a pivot block definition that delegates to:
  - `pivot.ensurePivot`
  - `pivot.removePivot`
  - `pivot.renamePivot`
  - `PivotView` / `PivotEditor` renderer as appropriate
- Preserve pivot state in `pivot.config.pivots`.
- Ensure generated relations, stale status, runtime stores, and cleanup are not
  hidden by the block abstraction.
- Evaluate whether pivot should expose both a view block and an executable/cell
  block adapter.

Acceptance criteria:

- Pivot can be expressed as a stateful block without losing runtime semantics.
- Existing pivot usage continues to work.
- The contract handles pivot cleanup/status without dashboard-specific
  assumptions.

Likely files/modules:

- `packages/pivot/src/*`
- App artifact registration if pivots are exposed as artifacts
- `packages/artifacts/src/*` if shell helper is used

Tests/checks:

- `pnpm --filter @sqlrooms/pivot typecheck`
- `pnpm --filter @sqlrooms/pivot build`
- `pnpm --filter @sqlrooms/pivot test`
- `pnpm --filter @sqlrooms/pivot lint`
- `pnpm --filter sqlrooms-cli-app typecheck` if integrated in the CLI.
- `pnpm --filter sqlrooms-cli-app build` if integrated in the CLI.
- `pnpm --filter sqlrooms-cli-app lint` if integrated in the CLI.
- `pnpm build`

### Stage 6: Convert Current Artifact Types

Convert current single-surface artifact type definitions to be generated from
stateful block definitions where practical.

Implementation notes:

- Convert straightforward single-surface artifact types first:
  - `dashboard`
  - `pivot`
  - `document` / Markdown document
- Keep `analysis` as a BlocksDocument container artifact, not a reusable
  stateful block implementation.
- Defer container/runtime-heavy artifact types until their contracts are clearer:
  - `notebook`
  - `canvas`
  - `app`
- Convert `app` later if the bridge can express generated files, previews, and
  WebContainer lifecycle clearly.
- Each feature package should export one stateful block definition that owns:
  - label/icon/render
  - ensure backing state
  - delete backing state
  - rename/title synchronization where applicable
  - transient runtime cleanup where applicable
- The CLI `ARTIFACT_TYPES` should become mostly bridge calls, not hand-written
  lifecycle mappings.
- Keep artifact type strings stable.
- Keep persisted feature state keyed by the same ids.

Acceptance criteria:

- At least three existing artifact types are generated from stateful block
  definitions.
- There is no duplicated lifecycle mapping for converted types.
- Existing top-level artifact behavior is unchanged.
- `analysis` is explicitly retained as a container artifact.
- `notebook`, `canvas`, and `app` are explicitly classified as deferred or
  needing richer adapters.

Likely files/modules:

- `apps/sqlrooms-cli-ui/src/artifactTypes.tsx`
- `packages/documents/src/*`
- `packages/mosaic/src/dashboard/*`
- `packages/notebook` package if notebook definitions live separately
- `packages/canvas` package if canvas definitions live separately
- `packages/artifacts/src/*`
- App builder/WebContainer modules for `app` evaluation

Tests/checks:

- Focused typechecks for converted packages.
- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm --filter @sqlrooms/documents build`
- `pnpm --filter @sqlrooms/documents lint`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter sqlrooms-cli-app typecheck`
- `pnpm --filter sqlrooms-cli-app build`
- `pnpm --filter sqlrooms-cli-app lint`
- `pnpm build`
- Manual browser smoke checks for each converted top-level artifact type.

### Stage 7: Blocks Document Stateful Block Host

Let blocks documents host stateful block instances directly, starting with one
candidate such as dashboard or pivot.

Implementation notes:

- Add a document block node/DTO for stateful blocks:

```ts
type StatefulBlockEmbed = {
  id: string;
  type: 'statefulBlock';
  blockType: string;
  blockInstanceId: string;
  title?: string;
  attrs?: Record<string, unknown>;
};
```

- The document block references a block instance id, not necessarily an
  artifact shell id.
- The stateful block host calls `ensureState` before rendering and uses the
  block definition renderer.
- Decide whether creating the document block creates a new block instance or
  references an existing one.
- Remove artifact embeds from blocks documents if backward compatibility is not
  required.

Acceptance criteria:

- A blocks document can host at least one stateful block without wrapping it as
  an artifact first.
- Multiple instances in one document have independent backing state unless they
  intentionally reference the same instance id.
- Blocks documents no longer expose artifact embed authoring or rendering
  paths.

Likely files/modules:

- `packages/documents/src/BlocksDocumentSliceConfig.ts`
- `packages/documents/src/BlocksDocumentEditor/extensions/*`
- `packages/documents/src/BlocksDocumentEditor/node-views/*`
- `packages/documents/src/BlocksDocumentCommands.ts`
- `packages/documents/src/BlocksDocumentAi.ts`
- Candidate feature-package stateful block adapter
- CLI document renderer providers

Tests/checks:

- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents build`
- `pnpm --filter @sqlrooms/documents lint`
- Candidate feature package typecheck
- `pnpm --filter sqlrooms-cli-app typecheck`
- `pnpm --filter sqlrooms-cli-app build`
- `pnpm --filter sqlrooms-cli-app lint`
- `pnpm build`
- Manual browser check for creating/rendering/removing hosted stateful blocks.

### Stage 8: Lifecycle and Ownership Semantics

Define clear ownership rules for stateful blocks hosted in artifacts,
documents, and possibly multiple containers.

Implementation notes:

- Decide and document instance ownership:
  - owned by artifact shell
  - owned by blocks document block
  - shared reference
  - external resource reference
- Add metadata if needed:

```ts
type StatefulBlockReference = {
  blockInstanceId: string;
  blockType: string;
  ownership: 'owned' | 'shared' | 'external';
};
```

- Define delete behavior for each ownership mode.
- Define title synchronization between shell title and block instance title.
- Define CRDT/persistence implications.

Acceptance criteria:

- Deleting a blocks document does not accidentally delete shared dashboard/pivot
  state.
- Deleting an owned stateful block cleans up backing state and runtime caches.
- Title/rename behavior is predictable.
- Tests cover ownership modes if implemented.

Likely files/modules:

- `packages/documents/src/*`
- `packages/artifacts/src/*`
- `packages/mosaic/src/dashboard/*`
- `packages/pivot/src/*`
- CRDT mirrors if synced state is affected

Tests/checks:

- Unit tests for ownership delete behavior.
- Package typechecks/tests.
- Manual smoke checks for delete/duplicate/share flows.

### Stage 9: AI and Command Integration

Teach commands and AI tools to create stateful blocks directly or as
single-block artifacts depending on context.

Implementation notes:

- Blocks document commands should be able to:
  - create dashboard/pivot as hosted stateful block
  - wrap dashboard/pivot as artifact shell when the user asks for a top-level
    artifact
  - create direct owned stateful block instances with backing state
- AI instructions should explain:
  - use hosted stateful blocks for local composition
  - use artifact shells for top-level workspace resources
  - use explicit stateful blocks for feature-backed content
- Keep command IDs stable where possible.

Acceptance criteria:

- AI can create a dashboard/pivot block in a blocks document.
- AI can create a top-level dashboard/pivot artifact using the same underlying
  block implementation.
- Tool output clearly reports ownership and instance ids.

Likely files/modules:

- `packages/documents/src/BlocksDocumentCommands.ts`
- `packages/documents/src/BlocksDocumentAi.ts`
- `packages/artifacts/src/ai.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- Candidate block adapter packages

Tests/checks:

- Command unit tests.
- AI instruction/helper tests.
- CLI typecheck/build.

### Stage 10: Migration and Package Boundary Decision

Decide whether the stateful block model justifies package/API changes.

Decision questions:

- Is the current default still right: concrete stateful block definitions live
  in their owning feature packages?
- Are the shared contracts in `@sqlrooms/blocks` still small and stable?
- Has any concrete runtime emerged that should move into `@sqlrooms/blocks`, or
  should the package remain contract-only?
- Should artifact type definitions become thin wrappers around block
  definitions?
- Should dashboard/pivot artifact APIs be renamed, or should artifact shells
  remain public?
- Do we need an explicit reference block later for shared, non-owned stateful
  block instances?
- Is persisted state migration worth it, or are adapters enough?

Recommended default:

- Keep artifacts as shells.
- Keep feature state in existing packages.
- Use `@sqlrooms/blocks` for shared contracts, vocabulary, reference/ownership
  types, capabilities, and host adapter types.
- Keep concrete stateful block definitions in their owning feature packages.
- Keep the artifact-shell bridge in `@sqlrooms/artifacts`.
- Keep `@sqlrooms/blocks` contract-first. Add concrete runtime only after a
  repeated implementation pattern cannot live cleanly in an owning feature
  package.
- Do not migrate existing persisted state unless a concrete simplification is
  demonstrated.

Acceptance criteria:

- A decision record captures the outcome of dashboard and pivot adapter stages.
- Follow-up migration work is explicit and separately scoped.
- Package boundary changes are not bundled with runtime behavior changes.

Likely files/modules:

- `dev-docs/tasks/stateful-blocks-artifact-shells.md`
- `dev-docs/tasks/root-block-artifacts.md`
- ADR docs if used
- Package READMEs

Tests/checks:

- Documentation review.

## Risks and Open Questions

- Stateful block abstraction may hide important lifecycle differences between
  dashboard, pivot, notebook, and app surfaces.
- A hosted stateful block needs stable identity even when its containing
  document block is copied, moved, duplicated, or deleted.
- Sharing the same block instance in multiple documents raises ownership,
  selection, runtime cache, and delete semantics.
- Dashboard panels are themselves block-like. Avoid two incompatible block
  models inside Mosaic dashboards and documents.
- Pivot generated relations and stale status are more execution-like than
  dashboard layout state; the contract must not become dashboard-only.
- Top-level artifacts provide useful user workflow affordances: tabs, current
  selection, AI context, and layout placement. Do not lose those by making
  everything "just blocks."
- CRDT sync may need to distinguish shell metadata from feature backing state
  and document-contained block references.
- AI prompts could become confusing if they expose "artifact shell",
  "stateful block", "resource embed", and "content block" all at once.

## Evaluation After Stages 1-3

Initial result: continue, but keep the next step narrow.

What worked:

- A contract-only `@sqlrooms/blocks` package is small and buildable.
- `createArtifactTypeFromStatefulBlock(...)` removes duplicated shell lifecycle
  mapping in principle without changing artifact persistence.
- The bridge can support artifact type strings that differ from block
  implementation types, which is important for product names like `analysis`.
- Existing artifact lifecycle tests are enough to validate the adapter behavior
  before converting real feature packages.

What still needs proof:

- A real dashboard or blocks-document adapter must show whether the contract
  shape is ergonomic outside tests.
- Artifact shell rendering currently passes only shell metadata; real adapters
  may need attrs, read-only mode, or host-specific context.
- Ownership semantics are still unresolved for stateful blocks hosted directly
  inside documents.

Recommended next step:

- Implement Stage 4 for dashboard or a similarly well-understood stateful
  feature. Do not convert all artifact types yet.

## Evaluation After Stage 4

Result: continue, with the same deliberately incremental posture.

What worked:

- The dashboard adapter fits the shared `StatefulBlockDefinition` contract
  without changing Mosaic dashboard persistence.
- The CLI dashboard artifact can now be generated from the single
  `createArtifactTypeFromStatefulBlock(...)` bridge instead of repeating the
  artifact lifecycle mapping by hand.
- The bridge still allows the CLI to provide its richer dashboard artifact
  renderer for app-specific AI behavior while Mosaic owns the generic dashboard
  stateful block definition.
- The adapter keeps selections and runtime caches keyed by dashboard id, so
  independent dashboard instances should remain isolated as long as they use
  distinct block/artifact ids.

What still needs proof:

- A successful manual browser smoke is still pending. The attempted in-app
  browser check was blocked by local navigation policy before the app loaded.
- Pivot should be adapted next to test a less dashboard-shaped lifecycle with
  generated relations, runtime stores, and stale status.
- The current render props are intentionally small. Hosted stateful blocks may
  later need attrs, read-only mode, ownership metadata, or host command context.

Recommended next step:

- Implement Stage 5 for pivot before converting more artifact types. If pivot
  also fits the contract cleanly, Stage 6 becomes much more credible.

## Evaluation After Stage 5

Result: continue. Pivot gives a useful second data point because it has runtime
stores and generated DuckDB relations, not just view/layout state.

What worked:

- The same `StatefulBlockDefinition` shape can express pivot creation, rename,
  render, and delete behavior without changing pivot persistence.
- The CLI can now expose pivot tables as a top-level artifact/block type using
  the same `createArtifactTypeFromStatefulBlock(...)` bridge.
- Mounting `createPivotSlice` in the CLI made the previously declared
  `PivotSliceState` real and persistable.
- Pivot relation cleanup remains owned by `pivot.removePivot`, so the block
  adapter does not duplicate generated-relation lifecycle logic.

What still needs proof:

- There is still no non-destructive pivot runtime eviction hook equivalent to
  dashboard runtime close behavior; Stage 8 should decide whether pivot needs
  one.
- Pivot as a hosted document block will need ownership semantics for generated
  relations when a containing block is duplicated or deleted.
- Interop with notebook/cell execution is still unresolved: pivot already has a
  cell adapter, and later stages should avoid creating competing pivot-cell and
  pivot-block lifecycles.

Recommended next step:

- Start Stage 6 only for the remaining straightforward artifact types, or pause
  to review the bridge ergonomics now that dashboard and pivot both use it.

Follow-up bridge cleanup:

- Dashboard and pivot now share a CLI-level stateful block artifact config for
  labels, default titles, embedded titles, embedded descriptions, and backing
  state ensure behavior.
- The top-level artifact type registry and the Analysis document insert menu
  both read from that config, so adding another stateful block artifact has one
  fewer split registration path.
- Analysis embed renderers are typechecked against the stateful block artifact
  config keys, so adding a new embeddable stateful artifact requires adding its
  renderer.

## Evaluation After Stage 6

Result: continue, but keep the conversion boundary narrower than "every
artifact becomes a stateful block."

What worked:

- Dashboard, pivot, and Markdown document are all representable as stateful
  block definitions and can be wrapped as top-level artifacts through the same
  bridge.
- Markdown document is a useful third data point because it is a report-like
  text surface that may also be useful inside a blocks document.
- The CLI `document` artifact no longer needs its own hand-written lifecycle
  mapping; it is generated from `createMarkdownDocumentBlockDefinition(...)`.
- The Analysis insert menu can expose `Document` as a direct hosted stateful
  block alongside dashboard and pivot.

What changed in the model:

- `analysis` should remain a BlocksDocument container artifact. It is meant to
  host and compose blocks, not to be embedded as a reusable single-surface block.
- `notebook`, `canvas`, and `app` remain deferred until their ownership,
  execution, or runtime lifecycles are clearer.
- Artifact embeds are no longer part of the target model because backward
  compatibility is not required; a future reference block can be designed
  explicitly if shared references become important.

Recommended next step:

- Implement Stage 8 ownership semantics before converting runtime-heavy types.
  Delete, copy/paste, duplicate, and title synchronization behavior should be
  explicit before notebook/app/canvas are considered.

## Evaluation After Stage 7

Result: the direct stateful block host is viable, but lifecycle ownership now
needs to become the next design focus.

What worked:

- Blocks documents now have a `statefulBlock` DTO and a
  `blocksDocumentStatefulBlock` Tiptap node for direct stateful block hosting.
- Dashboard, pivot, and Markdown document can be inserted into Analysis
  documents as direct stateful blocks without creating hidden embedded artifact
  shells.
- The Analysis insert menu now uses direct stateful block menu entries for
  dashboard, pivot, and document.

What still needs proof:

- Owned stateful block delete cleanup is not implemented yet. The current
  editor content persistence path does not emit precise per-node lifecycle
  events, so deleting a hosted dashboard/pivot/document block can leave backing
  slice state behind until Stage 8 defines ownership cleanup.
- Duplicating a block will duplicate the same `blockInstanceId` unless a later
  copy/paste normalization step rewrites ids and ownership metadata.
- The generic `embed-dashboard` command has been removed; Stage 9 should add
  host-specific AI tools for creating dashboard/pivot/document stateful blocks
  with their backing state.

Recommended next step:

- Implement Stage 8 before broadening to more stateful block types. Ownership,
  copy/delete cleanup, and title synchronization are now the highest-risk parts.

## Evaluation After Stage 8

Result: continue to AI/command integration. Owned direct stateful blocks now
have enough lifecycle semantics for normal create, rename, and delete flows.

What worked:

- `createBlocksDocumentsSlice()` now accepts host callbacks for owned stateful
  block delete and rename events.
- Removing an owned dashboard/pivot/document block, replacing document content,
  or deleting the containing blocks document can clean up backing feature state.
- `shared` and `external` stateful block references are intentionally not
  deleted by the documents slice.
- Block `title` changes can be synchronized into backing state through a host
  callback; block `caption` remains document-local.
- The CLI wires the callbacks to dashboard, pivot, and Markdown document
  cleanup/rename behavior.

What still needs proof:

- Copy/paste or duplicate normalization still needs a later pass so copied
  owned blocks get new `blockInstanceId` values instead of accidentally sharing
  state.
- AI still needs host-level tools for creating dashboard/pivot/document
  stateful blocks with backing state.

Recommended next step:

- Implement Stage 9 host command/AI integration for creating direct stateful
  blocks in Analysis documents.

## Evaluation After Stage 9

Result: continue to the package boundary decision. The assistant now has a
direct command path for hosted stateful blocks, so artifact embeds are no longer
needed for AI-authored dashboard/pivot/document content.

What worked:

- `createBlocksDocumentCommands()` now exposes
  `create-stateful-block`.
- Hosts can register supported stateful block command types with default
  titles and backing-state creation hooks.
- The CLI registers dashboard, pivot, and Markdown document as supported
  Analysis stateful block command types.
- AI instructions now point assistants at `create-stateful-block` for
  host-registered feature-backed blocks.
- Command tests cover creating hosted stateful blocks and rejecting unsupported
  block types when a host registry is provided.

What still needs proof:

- AI-authored dashboards still rely on separate dashboard-specific tools for
  filling the newly created dashboard with panels.
- Copy/paste or duplicate normalization remains a separate lifecycle follow-up.

Recommended next step:

- Complete Stage 10 by recording the package-boundary decision and whether the
  migration to stateful blocks is worth continuing beyond dashboard, pivot, and
  Markdown document.

## Progress Log

- 2026-05-29: Created staged plan for stateful block implementations with
  single-block artifact shells.
- 2026-05-29: Updated end state so current artifact type definitions are
  generated from stateful block definitions through one bridge where practical.
- 2026-05-29: Completed Stage 1 by recording vocabulary, boundaries, and the
  artifact-shell/stateful-block target model in this task document.
- 2026-05-29: Completed Stage 2 by adding the contracts-only
  `@sqlrooms/blocks` package.
- 2026-05-29: Completed Stage 3 by adding
  `createArtifactTypeFromStatefulBlock(...)` in `@sqlrooms/artifacts` with
  lifecycle tests.
- 2026-05-29: Completed Stage 4 by adding
  `createMosaicDashboardBlockDefinition(...)` in `@sqlrooms/mosaic`, converting
  the CLI dashboard artifact registration to the single-block shell bridge, and
  documenting the new Mosaic API.
- 2026-05-29: Completed Stage 5 by adding
  `createPivotBlockDefinition(...)` in `@sqlrooms/pivot`, mounting/persisting
  the pivot slice in the CLI app, and exposing pivot tables as a CLI
  artifact/block type through the single-block shell bridge.
- 2026-05-29: Added a CLI-level stateful block artifact config shared by
  top-level artifact registration and Analysis document embed menu registration
  for dashboard and pivot.
- 2026-05-29: Completed Stage 6 by adding
  `createMarkdownDocumentBlockDefinition(...)`, converting the CLI Markdown
  document artifact to the single-block shell bridge, and intentionally keeping
  `analysis` as a BlocksDocument container artifact.
- 2026-05-29: Completed Stage 7 by adding a direct
  `blocksDocumentStatefulBlock` host node, renderer registry, DTO conversion,
  and Analysis document dashboard/pivot/document stateful block renderers.
- 2026-05-29: Removed blocks document artifact embeds from the target model and
  implementation so documents compose direct blocks only.
- 2026-05-29: Completed Stage 8 by adding owned stateful block delete and rename
  lifecycle callbacks to `@sqlrooms/documents`, wiring CLI dashboard/pivot/
  document cleanup, and documenting ownership behavior.
- 2026-05-29: Completed Stage 9 by adding a generic
  `create-stateful-block` command, host-registered stateful block command
  types, CLI Analysis registration for dashboard/pivot/document, and updated AI
  instructions.
