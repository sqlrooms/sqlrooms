# Cells and Blocks Convergence

## Todo Checklist

- [ ] [Stage 1: Vocabulary and Boundaries](#stage-1-vocabulary-and-boundaries)
- [ ] [Stage 2: Shared Block Contract Draft](#stage-2-shared-block-contract-draft)
- [ ] [Stage 3: Cell Alias Layer](#stage-3-cell-alias-layer)
- [ ] [Stage 4: Container Shape Alignment](#stage-4-container-shape-alignment)
- [ ] [Stage 5: Registry Capability Model](#stage-5-registry-capability-model)
- [ ] [Stage 6: Notebook as Executable Root Block](#stage-6-notebook-as-executable-root-block)
- [ ] [Stage 7: Whole-Resource Embeds](#stage-7-whole-resource-embeds)
- [ ] [Stage 8: Shared Render and Config Primitives](#stage-8-shared-render-and-config-primitives)
- [ ] [Stage 9: Cross-Container References](#stage-9-cross-container-references)
- [ ] [Stage 10: Optional Executable Blocks Outside Notebooks](#stage-10-optional-executable-blocks-outside-notebooks)

## Goal

Converge the conceptual model of cells and blocks without flattening away the
important notebook execution semantics.

The target mental model:

```txt
Block
  - content block: paragraph, image, chart, embed
  - executable block: sql cell, input cell, vega cell
  - root block: notebook, dashboard, block document

Container
  - ordered/tree container: block document
  - graph-aware ordered container: notebook
```

Cells should be able to implement a shared block contract, but they should
remain cells in notebook UX where DAG execution, result ownership, status,
schema namespaces, and dependency invalidation are central.

## Non-Goals

- Do not rebuild notebook DAG execution inside `BlockDocument` in the core
  convergence stages.
- Do not make every content block executable.
- Do not make every executable cell editable as a Tiptap node.
- Do not inline notebook backing state into a parent document.
- Do not replace `@sqlrooms/cells` with a generic blocks package until the
  shared contracts have proven useful.
- Do not force chart cells, dashboard chart panels, and standalone document
  chart blocks to share persisted schemas before their runtime needs are
  reconciled.

## Current Architecture Findings

### Cells

- `@sqlrooms/cells` defines extensible cells with `{id, type, data}`.
- Built-in cell types include `sql`, `text`, `vega`, and `input`.
- `CellRegistryItem` owns type-specific behavior:
  - `createCell`
  - `renderCell`
  - `findDependencies`
  - optional `runCell`
  - optional lifecycle/status helpers
  - optional relation cleanup/result helpers
- `CellsSliceConfig` stores:
  - `data`: all cells by id
  - `artifacts`: notebook/cell-container runtime keyed by artifact id
  - `tableDepSchemas`
- `CellArtifactRuntime` stores container-local execution structure:
  - `id`
  - `schemaName`
  - `cellIds`
  - `edges`
  - `graphCache`
- DAG behavior includes dependency discovery, dependency/dependent cache,
  topological ordering, cascade execution, stale invalidation, and table
  dependency tracking.
- Cell result data is runtime/cache state outside persisted config.

### Block Documents

- `@sqlrooms/documents` stores `BlockDocument` content as Tiptap/ProseMirror
  JSON.
- Block document DTOs expose content blocks such as text, image, chart, and
  root-resource embeds.
- Standalone document chart blocks already aim to reuse Mosaic/vgplot chart
  implementations without becoming dashboard panels.
- Block documents are currently ordered/tree content containers, not execution
  DAG containers.

### Root Blocks / Artifacts

- See `dev-docs/tasks/root-block-artifacts.md`.
- Artifacts are moving conceptually toward root blocks: addressable resources
  with stable ids, type, title, visibility, parent linkage, lifecycle, tabs,
  and AI context.
- Notebooks should likely be modeled as root blocks whose internal content is a
  graph-aware ordered collection of executable blocks.

## Proposed Implementation Approach

Converge in the core model first:

1. Define the language and invariants.
2. Introduce a small shared block contract that cells can satisfy.
3. Add aliases/adapters in `@sqlrooms/cells` without changing persistence.
4. Align notebook container terminology with graph-aware block containers.
5. Extract the common registry/capability concepts.

Only after that, add interoperability:

1. Embed whole notebooks in block documents as root blocks.
2. Share chart/text/input render/config primitives across cells and document
   blocks.
3. Add cross-container references where a document block can read notebook
   outputs without joining the notebook DAG.
4. Consider executable blocks outside notebooks only if there is a concrete
   product need.

## Stages

### Stage 1: Vocabulary and Boundaries

Document the relationship between cells, blocks, and root blocks.

Implementation notes:

- Define:
  - content block
  - executable block
  - root block
  - ordered block container
  - graph-aware block container
- State explicitly that a notebook is not "just" a block document with edges;
  it owns execution, status, result cache, and relation cleanup.
- State that whole-notebook embedding is the preferred first interoperability
  path.

Acceptance criteria:

- Documentation explains why cells can implement a block contract while
  remaining cells in notebook UX.
- Documentation separates core convergence from later interoperability.
- No code changes.

Likely files/modules:

- `dev-docs/tasks/cells-blocks-convergence.md`
- `dev-docs/tasks/root-block-artifacts.md`
- `dev-docs/contributing/architecture.md`

Tests/checks:

- Documentation review.
- `pnpm format` if broader docs are touched.

### Stage 2: Shared Block Contract Draft

Introduce a minimal type-only shared contract in the most conservative package
location.

Implementation notes:

- Draft types such as:

```ts
export type BlockBase = {
  id: string;
  type: string;
  title?: string;
};

export type OrderedBlockContainer = {
  blockIds: string[];
};

export type GraphBlockEdge = {
  id: string;
  source: string;
  target: string;
  kind?: string;
};

export type GraphBlockContainer = OrderedBlockContainer & {
  edges: GraphBlockEdge[];
};
```

- Prefer type aliases and helper functions over moving runtime behavior.
- Decide whether these live temporarily in `@sqlrooms/cells`, `@sqlrooms/documents`,
  or a tiny shared package later.
- Do not change persisted schemas in this stage.

Acceptance criteria:

- Shared contract types exist and are exported from a deliberate location.
- Cells and block document DTOs can be described in terms of the contract
  without changing their persisted representation.
- Typecheck passes with no runtime behavior change.

Likely files/modules:

- New shared type module, package TBD
- `packages/cells/src/types.ts`
- `packages/documents/src/BlockDocumentSliceConfig.ts`
- Package README for whichever package exports the contract

Tests/checks:

- `pnpm --filter @sqlrooms/cells typecheck`
- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm build`

### Stage 3: Cell Alias Layer

Add executable-block aliases in `@sqlrooms/cells` while retaining the cell
domain API.

Implementation notes:

- Add aliases such as:

```ts
export const ExecutableBlock = Cell;
export type ExecutableBlock = Cell;
export type ExecutableBlockType = CellType;
export type ExecutableBlockRegistryItem = CellRegistryItem;
```

- Consider helper names:
  - `isExecutableBlock`
  - `createExecutableBlockRegistry`
  - `ExecutableBlockStatus`
- Keep primary notebook APIs named `cells` for now.
- Avoid deprecating cell names in this stage.

Acceptance criteria:

- New executable-block names are available for cross-package vocabulary.
- Existing cell APIs remain unchanged.
- No persisted state migration is required.
- README explains that cells are executable blocks in notebook contexts.

Likely files/modules:

- `packages/cells/src/types.ts`
- `packages/cells/src/index.ts`
- `packages/cells/README.md`

Tests/checks:

- `pnpm --filter @sqlrooms/cells typecheck`
- `pnpm --filter @sqlrooms/cells build`
- `pnpm --filter @sqlrooms/cells lint`

### Stage 4: Container Shape Alignment

Align notebook runtime terminology with graph-aware block containers without
renaming persisted fields.

Implementation notes:

- Treat `CellArtifactRuntime.cellIds` as ordered executable block ids.
- Treat `CellArtifactRuntime.edges` as graph block edges.
- Add adapter helpers:
  - `cellArtifactToGraphBlockContainer`
  - `graphBlockContainerToCellArtifactPatch`
  - `getExecutableBlockIds`
  - `getExecutableBlockEdges`
- Keep `CellArtifactRuntime` as the persisted schema name for now.

Acceptance criteria:

- Tests prove adapters preserve ids, order, and edges.
- DAG utilities can be described using graph block container concepts.
- No behavior change to cascade execution.

Likely files/modules:

- `packages/cells/src/types.ts`
- `packages/cells/src/dagUtils.ts`
- `packages/cells/src/helpers.ts`
- `packages/cells/src/cellsSlice.ts`

Tests/checks:

- `pnpm --filter @sqlrooms/cells typecheck`
- `pnpm --filter @sqlrooms/cells test`
- `pnpm --filter @sqlrooms/cells lint`

### Stage 5: Registry Capability Model

Extract common vocabulary from cell registries, block document renderers, and
root block/artifact type definitions.

Implementation notes:

- Introduce capability language without forcing one giant registry:

```ts
type BlockCapabilities = {
  renderable?: true;
  embeddable?: true;
  executable?: true;
  participatesInDag?: true;
  producesRelation?: true;
  consumesRelation?: true;
};
```

- Map existing concepts:
  - `CellRegistryItem.runCell` -> `executable`
  - `CellRegistryItem.findDependencies` -> `participatesInDag`
  - artifact/root-block lifecycle hooks -> root resource lifecycle
  - document chart renderer -> renderable content block
- Keep package-specific registries, but add adapters or metadata fields where
  useful.

Acceptance criteria:

- There is a documented capability vocabulary shared by cells, blocks, and root
  blocks.
- Cell registry items can expose capabilities without changing how notebooks
  execute.
- Block document renderers are not forced to implement execution hooks.

Likely files/modules:

- Shared type module or package README
- `packages/cells/src/types.ts`
- `packages/documents/src/BlockDocument*`
- `packages/artifacts/src/ArtifactTypes.ts`

Tests/checks:

- Typecheck affected packages.
- Unit tests only where capability helpers perform logic.
- `pnpm build`

### Stage 6: Notebook as Executable Root Block

Represent notebooks in the root-block/artifact vocabulary while keeping cell
state in `@sqlrooms/cells`.

Implementation notes:

- Ensure notebook artifact/root-block lifecycle clearly owns a
  graph-aware executable block container.
- Add root-block-facing helpers:
  - `ensureNotebookRootBlock`
  - `removeNotebookRootBlock`
  - `getNotebookExecutableBlocks`
- If root-block aliases from `@sqlrooms/artifacts` exist, use them in new
  notebook-facing code.
- Keep all DAG execution and cell state in `@sqlrooms/cells`.

Acceptance criteria:

- Notebook can be described as a root block with executable block content.
- Existing notebook behavior is unchanged.
- Lifecycle hooks still create/remove cell artifact runtime state.

Likely files/modules:

- Notebook package files
- CLI artifact type registration
- `packages/cells/src/*`
- `packages/artifacts/src/*` if root block facade exists

Tests/checks:

- Notebook package typecheck/build.
- `pnpm --filter @sqlrooms/cells typecheck`
- CLI app typecheck/build if registration changes.

## Later Interoperability Stages

These stages should come after the core convergence work above. They are likely
to touch product behavior and should be treated as follow-up features.

### Stage 7: Whole-Resource Embeds

Allow block documents to embed whole notebooks as root blocks.

Implementation notes:

- Extend root-block embed support to notebook root blocks.
- The embedded notebook keeps independent cell state, DAG, schema namespace,
  result cache, and execution controls.
- This mirrors dashboard embeds and should be the default answer when the user
  wants a DAG inside a document.

Acceptance criteria:

- A block document can embed a notebook root block.
- Multiple embedded notebooks in one document run independently.
- Deleting the owning document handles embedded notebook lifecycle according to
  the chosen root-block ownership rules.

Likely files/modules:

- `packages/documents/src/BlockDocumentEmbedRendererContext.tsx`
- Notebook renderer/component package
- CLI artifact type configuration
- Root-block/artifact lifecycle helpers

Tests/checks:

- Documents package typecheck/tests.
- Notebook package typecheck/tests.
- CLI app typecheck/build.
- Manual browser smoke test for embedded notebook rendering.

### Stage 8: Shared Render and Config Primitives

Reuse implementations where behavior overlaps without merging persisted state.

Implementation notes:

- Candidate reuse:
  - Vega cell chart renderer and document chart block renderer
  - chart config panels
  - text cell and rich text/content block display helpers
  - input cell controls and parameter/control document blocks
- Keep runtime ownership separate:
  - notebook chart cell can participate in DAG/crossfilter
  - document chart block can remain document-scoped and non-executable
  - dashboard chart panel can remain dashboard-scoped

Acceptance criteria:

- At least one shared chart/text/input primitive is extracted and used by two
  contexts.
- No context accidentally inherits execution semantics it does not support.
- UI behavior remains consistent across notebook and document contexts.

Likely files/modules:

- `packages/cells/src/components/*`
- `packages/documents/src/BlockDocumentEditor/*`
- `packages/mosaic` chart primitives if chart reuse is better located there
- CLI chart renderer adapters

Tests/checks:

- Affected package typechecks.
- Existing tests for cells/documents.
- Manual visual smoke checks for reused UI.

### Stage 9: Cross-Container References

Allow blocks in one container to reference outputs from another root block
without joining that root block's execution DAG.

Implementation notes:

- Example: a document chart block reads a notebook SQL cell result by reference.
- Reference shape might include:

```ts
type BlockDataReference = {
  rootBlockId: string;
  blockId: string;
  output?: string;
};
```

- The referenced notebook remains the execution owner.
- The document block can render stale/missing/error states if the source output
  is unavailable.
- Do not cascade-run notebooks from document rendering unless explicitly
  requested.

Acceptance criteria:

- Document blocks can read from notebook outputs through a stable reference.
- Missing/stale outputs are handled clearly.
- No implicit cross-container DAG execution is introduced.

Likely files/modules:

- Shared reference type module
- `packages/cells` result lookup helpers
- `packages/documents` chart/data-source block adapters
- CLI AI instructions/commands

Tests/checks:

- Unit tests for reference resolution.
- Typechecks for cells/documents/CLI.
- Manual smoke test with a notebook SQL result feeding a document chart.

### Stage 10: Optional Executable Blocks Outside Notebooks

Consider allowing executable blocks in documents only if a product workflow
requires it.

Implementation notes:

- This is the highest-risk interoperability stage.
- Possible designs:
  - document owns a small embedded executable block container
  - executable document blocks delegate to a hidden notebook root block
  - executable blocks are shown in documents but stored in a notebook
- Prefer explicit execution surfaces over hidden DAG behavior.

Acceptance criteria:

- A concrete workflow justifies executable blocks in documents.
- Execution ownership is explicit in UI and state.
- Dependency and result semantics are documented before implementation.

Likely files/modules:

- `packages/documents`
- `packages/cells`
- Notebook package
- CLI AI commands/tools

Tests/checks:

- New execution tests.
- Cross-package typechecks.
- Browser/manual tests for editing, running, stale state, and deletion.

## Risks and Open Questions

- The word "block" can become too broad. We need clear qualifiers: content
  block, executable block, root block.
- Cells have real execution semantics that should not leak into ordinary
  document blocks by accident.
- Shared registries can become too abstract if we force all block types into
  one interface too early.
- Chart interoperability has three contexts with different runtime ownership:
  document chart blocks, notebook chart cells, and dashboard panels.
- Cross-container references may need permissions/visibility rules once rooms
  support richer sharing.
- Embedded notebooks need careful lifecycle rules. A notebook embedded in two
  documents cannot be treated as exclusively owned by either without explicit
  ownership metadata.
- Result cache and relation cleanup are currently cell-specific. A generic
  block layer should not own DuckDB cleanup until there is a proven abstraction.
- AI tools could become confusing if they expose artifact, root block, block,
  and cell terms at once. Prompt vocabulary should follow the user's task
  level.

## Progress Log

- 2026-05-29: Created staged plan for core cells/blocks convergence with
  interoperability deferred to later stages.
