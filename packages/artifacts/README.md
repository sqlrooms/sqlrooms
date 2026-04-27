`@sqlrooms/artifacts` provides a room-store slice and React/layout helpers for
workspace artifacts such as dashboards, notebooks, canvas documents, pivot
tables, and apps.

Artifacts are durable workspace entries. Artifact tabs are the layout/UI adapter
for opening, closing, renaming, reordering, searching, and deleting those
entries.

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

## Artifact Tabs

- `useArtifactTabs({tabsId?, types?, panelKey?})` returns TabStrip-compatible
  descriptors, open tab ids, selected id, and handlers.
- `ArtifactTabs` is a compound component over `TabStrip` and
  `TabsLayout.TabContent`.
- `createArtifactLayoutNode(artifactId, panelKey?)` creates a stable layout
  panel node for an artifact.
- `createArtifactPanelDefinition(artifactTypes, store)` resolves artifact panel
  titles, icons, and components from the runtime type registry.

Type definitions are runtime configuration and are not persisted.
