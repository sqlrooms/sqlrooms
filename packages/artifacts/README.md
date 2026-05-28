`@sqlrooms/artifacts` provides a room-store slice and React/layout helpers for
workspace artifacts such as dashboards, notebooks, canvas documents, pivot
tables, and apps.

Artifacts are durable workspace entries. Artifact tabs are the layout/UI adapter
for opening, closing, renaming, reordering, searching, and deleting those
entries.

Artifacts can be top-level workspace entries or embedded child entries. Embedded
artifacts use `visibility: 'embedded'` and `parentArtifactId` on their metadata;
they stay in the artifact registry for lifecycle and persistence, but
`ArtifactTabs` hides them by default.

## Usage

```tsx
import {
  ArtifactTabs,
  ArtifactsSliceConfig,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
} from '@sqlrooms/artifacts';

const artifactTypes = defineArtifactTypes({
  notebook: {
    label: 'Notebook',
    defaultTitle: 'Notebook',
    icon: FileTextIcon,
    component: NotebookPanel,
    onCreate: ({artifactId, store}) => {
      store.getState().notebook.ensureArtifact(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().notebook.ensureArtifact(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().notebook.removeArtifact(artifactId);
    },
  },
});

const store = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        artifacts: ArtifactsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createArtifactsSlice<RoomState>({artifactTypes})(set, get, store),
      layout: {
        panels: {
          artifact: createArtifactPanelDefinition(artifactTypes, store),
        },
      },
    }),
  ),
);
```

```tsx
<ArtifactTabs types={['notebook']} panelKey="artifact">
  <ArtifactTabs.SearchDropdown />
  <ArtifactTabs.Tabs />
  <ArtifactTabs.NewButton artifactType="notebook" />
</ArtifactTabs>
```

Use `ArtifactTabs.useActions()` from custom subcomponents when you need access
to the tab adapter actions, and use `overlay` for dialogs or other elements that
need that context without being rendered inside the tab strip.

## Slice API

Config uses artifact terminology throughout:

- `artifacts.config.artifactsById`
- `artifacts.config.artifactOrder`
- `artifacts.config.currentArtifactId`

- `artifacts.createArtifact({type, title?, id?})`
- `artifacts.ensureArtifact(id, {type, title?})`
- `artifacts.renameArtifact(id, title)`
- `artifacts.closeArtifact(id)`
- `artifacts.deleteArtifact(id)`
- `artifacts.setCurrentArtifact(id?)`
- `artifacts.setArtifactOrder(order)`
- `artifacts.getArtifact(id)`

`closeArtifact` is non-destructive. It runs close lifecycle cleanup, while the
tab adapter hides the layout tab so it can be reopened from search.

`deleteArtifact` is destructive. It runs close and delete lifecycle hooks, then
removes the artifact registry entry.

`createArtifact` and `ensureArtifact` accept optional embedded-child metadata:

```ts
artifacts.createArtifact({
  type: 'dashboard',
  title: 'Embedded Dashboard',
  visibility: 'embedded',
  parentArtifactId: analysisArtifactId,
});
```

Deleting a parent artifact does not cascade-delete child artifacts by default.
Callers that own embedded children should apply their own cascade policy in the
parent artifact lifecycle hook.

## Artifact Tabs

- `useArtifactTabs({tabsId?, types?, panelKey?})` returns TabStrip-compatible
  descriptors, open tab ids, selected id, and handlers.
- Embedded artifacts are omitted from tabs and search by default. Pass
  `includeEmbedded: true` when a specialized surface needs to show or open them.
- `ArtifactTabs` is a compound component over `TabStrip` and
  `TabsLayout.TabContent`.
- Pass `forceMountContent` to `ArtifactTabs` to keep visible artifact tab
  panels mounted while hiding inactive panels.
- `ArtifactTabs.useActions()` exposes the current tab adapter actions to custom
  subcomponents rendered under `ArtifactTabs`.
- `createArtifactLayoutNode(artifactId, panelKey?)` creates a stable layout
  panel node for an artifact.
- `createArtifactPanelDefinition(artifactTypes, store)` resolves artifact panel
  titles, icons, and components from the runtime type registry.

Type definitions are runtime configuration and are not persisted.

## AI Context Tools

`@sqlrooms/artifacts/ai` provides reusable assistant tools for artifact context:

- `list_context_artifacts`
- `read_context_artifact`
- `set_primary_context_artifact`

Use `createArtifactContextAiTools({store, readArtifact})` in apps that combine
`@sqlrooms/artifacts` with `@sqlrooms/ai`. The factory handles primary artifact
selection and run-context updates; the app supplies artifact payload readers for
domain-specific types such as documents or dashboards.
