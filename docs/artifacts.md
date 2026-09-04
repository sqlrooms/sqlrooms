---
outline: deep
---

# Artifacts

Artifacts are durable, top-level entries in a SQLRooms workspace. A dashboard,
notebook, canvas, pivot table, or document can all be represented as artifacts
and opened through the same workspace navigation.

The artifact registry owns workspace metadata and navigation state. Feature
packages continue to own their domain state:

| Artifact registry                         | Feature slice                                                    |
| ----------------------------------------- | ---------------------------------------------------------------- |
| ID, type, and title                       | Queries, cells, charts, document content, and other domain state |
| Order, pinning, and current selection     | Feature-specific runtime status                                  |
| Open, close, rename, and delete lifecycle | Create, ensure, rename, close, and cleanup behavior              |

This separation keeps artifact APIs small while allowing feature state to be
used in other hosts. For example, the same pivot definition can be a top-level
artifact or an embedded block in a document.

## Define artifact types

An artifact type connects workspace actions to a feature's component and
lifecycle. Keep these definitions in runtime configuration; only artifact
metadata is persisted.

```tsx
import {
  ArtifactTabs,
  ArtifactsSliceConfig,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  PivotSliceConfig,
  PivotView,
  createPivotSlice,
  type PivotSliceState,
} from '@sqlrooms/pivot';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {TablePropertiesIcon} from 'lucide-react';

type RoomState = RoomShellSliceState & ArtifactsSliceState & PivotSliceState;

const PivotArtifactPanel: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId =
    typeof meta?.artifactId === 'string' ? meta.artifactId : panelId;
  return <PivotView pivotId={artifactId} />;
};

const PivotWorkspacePanel: RoomPanelComponent = () => (
  <ArtifactTabs types={['pivot']} panelKey="artifact">
    <ArtifactTabs.SearchDropdown />
    <ArtifactTabs.Tabs />
    <ArtifactTabs.NewButton artifactType="pivot" />
  </ArtifactTabs>
);

const artifactTypes = defineArtifactTypes({
  pivot: {
    label: 'Pivot table',
    defaultTitle: 'Pivot table',
    icon: TablePropertiesIcon,
    component: PivotArtifactPanel,
    onCreate: ({artifactId, artifact, store}) => {
      store.getState().pivot.ensurePivot(artifactId, {
        title: artifact.title,
      });
    },
    onEnsure: ({artifactId, artifact, store}) => {
      store.getState().pivot.ensurePivot(artifactId, {
        title: artifact.title,
      });
    },
    onRename: ({artifactId, artifact, store}) => {
      store.getState().pivot.renamePivot(artifactId, artifact.title);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().pivot.removePivot(artifactId);
    },
  },
} satisfies Record<'pivot', ArtifactTypeDefinition<RoomState>>);

export const {roomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'my-workspace',
      sliceConfigSchemas: {
        artifacts: ArtifactsSliceConfig,
        pivot: PivotSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        layout: {
          config: {
            id: 'workspace',
            type: 'tabs',
            panel: 'workspace',
            children: [],
            activeTabIndex: 0,
          },
          panels: {
            workspace: {
              title: 'Pivots',
              icon: TablePropertiesIcon,
              component: PivotWorkspacePanel,
            },
            artifact: createArtifactPanelDefinition(artifactTypes, store),
          },
        },
      })(set, get, store),
      ...createArtifactsSlice({artifactTypes})(set, get, store),
      ...createPivotSlice()(set, get, store),
    }),
  ),
);
```

Use the lifecycle callbacks consistently:

- `onCreate` initializes backing state for a new registry entry.
- `onEnsure` repairs or initializes backing state while restoring a known
  artifact.
- `onRename` mirrors a workspace title only when the feature owns a related
  display name.
- `onClose` releases temporary runtime resources without deleting durable
  state.
- `onDelete` removes feature-owned durable state.

`closeArtifact()` is intentionally non-destructive. The tab adapter removes the
artifact from the active layout while leaving it available to reopen.
`deleteArtifact()` runs close and delete lifecycle hooks, then removes the
registry entry.

## Persist the registry

Add `ArtifactsSliceConfig` to the room's persisted slice schemas. The config
contains only serializable workspace state. The setup above persists both
`artifacts` and `pivot`, so every registry entry can restore its backing state.

Persist the feature slice alongside the registry. Persisting an artifact entry
without its backing state can restore a tab that has nothing to render.

See [Persistence](/persistence) for storage adapters, hydration, and autosave.

## Render an artifact workspace

`ArtifactTabs` is the standard layout adapter. Its compound API keeps custom
controls and tab content on one shared workspace model. It must render inside a
layout node with `type: 'tabs'`; the setup above mounts `PivotWorkspacePanel`
as the fallback panel for the `workspace` tabs node. `ArtifactTabs` then adds
and removes artifact panel children in that container.

For a sidebar, home screen, or other surface that does not use layout tabs,
use `useArtifactWorkspace()` directly:

```tsx
const workspace = useArtifactWorkspace({
  types: ['pivot', 'dashboard'],
});

return workspace.selectedArtifact ? (
  <ArtifactSummary artifact={workspace.selectedArtifact} />
) : (
  <button onClick={() => workspace.createArtifact('pivot')}>
    New pivot table
  </button>
);
```

## Reuse stateful blocks as artifacts

Feature packages can expose a `StatefulBlockDefinition` from
`@sqlrooms/blocks`. Wrap that definition when the same feature should also be
available as a top-level artifact:

```ts
import {createArtifactTypeFromStatefulBlock} from '@sqlrooms/artifacts';
import {createPivotBlockDefinition} from '@sqlrooms/pivot';

const artifactTypes = defineArtifactTypes({
  pivot: createArtifactTypeFromStatefulBlock(createPivotBlockDefinition()),
});
```

The artifact still owns the workspace title, selection, and navigation. The
stateful block owns rendering and feature-state lifecycle. This is preferable
to creating separate artifact-only and embedded implementations.

## Server and tooling entry points

Use the smallest package entry point that fits the caller:

- `@sqlrooms/artifacts` includes the store slice and React helpers.
- `@sqlrooms/artifacts/config` contains serializable schemas without React.
- `@sqlrooms/artifacts/ai` contains artifact context tools and optional
  artifact-owned AI sessions.

See the [`@sqlrooms/artifacts` API reference](/api/artifacts/) for the complete
API, [Blocks and Block Documents](/blocks-and-documents) for embedding feature
state inside structured documents, and [Commands](/commands) for exposing
artifact actions across UI and agent surfaces.
