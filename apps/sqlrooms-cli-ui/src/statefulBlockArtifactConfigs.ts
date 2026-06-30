import type {
  BlockSettingsComponent,
  BlockDocumentStatefulBlockCreateNodeOptions,
  BlockDocumentStatefulBlockCommandType,
  BlockDocumentStatefulBlockType,
} from '@sqlrooms/documents';
import {DeckMapBlockSettings, ensureDeckMapBlockState} from '@sqlrooms/deck';
import {
  DataTableBlockSettings,
  MosaicDashboardSettings,
} from '@sqlrooms/mosaic';
import type {RoomState} from './store-types';

export type FeatureStability = 'stable' | 'experimental';

export type StatefulBlockArtifactConfig<TArtifactType extends string = string> =
  {
    artifactType: TArtifactType;
    stability: FeatureStability;
    label: string;
    defaultTitle: string;
    embeddedTitle: string;
    embeddedDescription: string;
    resizableHeight?: boolean;
    defaultHeight?: number;
    minHeight?: number;
    maxHeight?: number;
    requireScrollModifier?: boolean;
    scrollHintLabel?: string;
    settings?: BlockSettingsComponent;
    ensureState: (
      state: RoomState,
      artifactId: string,
      title: string,
      options?: BlockDocumentStatefulBlockCreateNodeOptions,
    ) => void;
    deleteState: (state: RoomState, artifactId: string) => void;
    renameState?: (state: RoomState, artifactId: string, title: string) => void;
  };

export const STATEFUL_BLOCK_ARTIFACT_CONFIGS = {
  dashboard: {
    artifactType: 'dashboard',
    stability: 'stable',
    label: 'Dashboard',
    defaultTitle: 'Dashboard',
    embeddedTitle: 'Embedded Dashboard',
    embeddedDescription: 'Embedded dashboard',
    resizableHeight: true,
    defaultHeight: 560,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this dashboard',
    settings: MosaicDashboardSettings,
    ensureState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title, 'grid');
    },
    deleteState: (state, artifactId) => {
      state.mosaicDashboard.removeDashboard(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title, 'grid');
    },
  },
  pivot: {
    artifactType: 'pivot',
    stability: 'experimental',
    label: 'Pivot Table',
    defaultTitle: 'Pivot Table',
    embeddedTitle: 'Embedded Pivot Table',
    embeddedDescription: 'Embedded pivot table',
    ensureState: (state, artifactId, title) => {
      state.pivot.ensurePivot(artifactId, {title});
    },
    deleteState: (state, artifactId) => {
      state.pivot.removePivot(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.pivot.renamePivot(artifactId, title);
    },
  },
  'data-table': {
    artifactType: 'data-table',
    stability: 'stable',
    label: 'Data Table',
    defaultTitle: 'Data Table',
    embeddedTitle: 'Data Table',
    embeddedDescription: 'Embedded Mosaic Data Table Explorer',
    resizableHeight: true,
    defaultHeight: 640,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this data table',
    settings: DataTableBlockSettings,
    ensureState: () => {},
    deleteState: () => {},
  },
  map: {
    artifactType: 'map',
    stability: 'experimental',
    label: 'Map',
    defaultTitle: 'Map',
    embeddedTitle: 'Embedded Map',
    embeddedDescription: 'Embedded Deck.gl map',
    resizableHeight: true,
    defaultHeight: 560,
    minHeight: 360,
    maxHeight: 1600,
    requireScrollModifier: true,
    scrollHintLabel: 'this map',
    settings: DeckMapBlockSettings,
    ensureState: (state, artifactId, title) => {
      ensureDeckMapBlockState(state, artifactId, title);
    },
    deleteState: (state, artifactId) => {
      state.mosaicDashboard.removeDashboard(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.mosaicDashboard.ensureDashboard(artifactId, title, 'grid');
    },
  },
  document: {
    artifactType: 'document',
    stability: 'experimental',
    label: 'Document',
    defaultTitle: 'Document',
    embeddedTitle: 'Embedded Document',
    embeddedDescription: 'Embedded Markdown document',
    ensureState: (state, artifactId, _title, options) => {
      state.documents.ensureDocument(artifactId, options?.initialText);
    },
    deleteState: (state, artifactId) => {
      state.documents.removeDocument(artifactId);
    },
  },
  'sql-query': {
    artifactType: 'sql-query',
    stability: 'experimental',
    label: 'SQL Query',
    defaultTitle: 'SQL Query',
    embeddedTitle: 'Embedded SQL Query',
    embeddedDescription: 'Embedded SQL query editor and result table',
    ensureState: (state, artifactId, title, options) => {
      state.sqlEditor.ensureQuery(artifactId, {
        name: title,
        query: options?.initialText,
      });
    },
    deleteState: (state, artifactId) => {
      state.sqlEditor.removeQuery(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.sqlEditor.renameQuery(artifactId, title);
    },
  },
  'html-app': {
    artifactType: 'html-app',
    stability: 'experimental',
    label: 'HTML App',
    defaultTitle: 'HTML App',
    embeddedTitle: 'Embedded HTML App',
    embeddedDescription: 'Sandboxed HTML app with read-only SQL access',
    resizableHeight: true,
    defaultHeight: 560,
    minHeight: 320,
    maxHeight: 1600,
    ensureState: (state, artifactId, title) => {
      state.htmlApps.ensureApp(artifactId, {
        title,
        requestedCapabilities: ['query'],
        grantedCapabilities: ['query'],
      });
    },
    deleteState: (state, artifactId) => {
      state.htmlApps.removeApp(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.htmlApps.renameApp(artifactId, title);
    },
  },
  python: {
    artifactType: 'python',
    stability: 'experimental',
    label: 'Python',
    defaultTitle: 'Python',
    embeddedTitle: 'Python',
    embeddedDescription: 'Python analysis block with visible code and outputs',
    ensureState: (state, artifactId, title, options) => {
      state.python.ensureBlock(artifactId, {
        title,
        code: options?.initialText,
      });
    },
    deleteState: (state, artifactId) => {
      state.python.removeBlock(artifactId);
    },
    renameState: (state, artifactId, title) => {
      state.python.renameBlock(artifactId, title);
    },
  },
} as const satisfies Record<string, StatefulBlockArtifactConfig>;

export type StatefulBlockArtifactType =
  keyof typeof STATEFUL_BLOCK_ARTIFACT_CONFIGS;

export const STATEFUL_BLOCK_ARTIFACT_TYPES = Object.keys(
  STATEFUL_BLOCK_ARTIFACT_CONFIGS,
) as StatefulBlockArtifactType[];

export function isStatefulBlockArtifactType(
  artifactType: string,
): artifactType is StatefulBlockArtifactType {
  return artifactType in STATEFUL_BLOCK_ARTIFACT_CONFIGS;
}

export function getStatefulBlockArtifactConfig(
  artifactType: StatefulBlockArtifactType,
): StatefulBlockArtifactConfig<StatefulBlockArtifactType> {
  return STATEFUL_BLOCK_ARTIFACT_CONFIGS[artifactType];
}

function getEnabledStatefulBlockArtifactTypes(experimentalEnabled: boolean) {
  return STATEFUL_BLOCK_ARTIFACT_TYPES.filter((artifactType) => {
    const config = getStatefulBlockArtifactConfig(artifactType);
    return config.stability === 'stable' || experimentalEnabled;
  });
}

export function createStatefulBlockTypes({
  getState,
  experimentalEnabled = false,
}: {
  getState: () => RoomState;
  experimentalEnabled?: boolean;
}): BlockDocumentStatefulBlockType[] {
  return getEnabledStatefulBlockArtifactTypes(experimentalEnabled).map(
    (artifactType) => {
      const config = getStatefulBlockArtifactConfig(artifactType);
      return {
        blockType: config.artifactType,
        label: config.label,
        description: config.embeddedDescription,
        resizableHeight: config.resizableHeight,
        defaultHeight: config.defaultHeight,
        minHeight: config.minHeight,
        maxHeight: config.maxHeight,
        requireScrollModifier: config.requireScrollModifier,
        scrollHintLabel: config.scrollHintLabel,
        settings: config.settings,
        createNode: (blockId, options) => {
          const state = getState();
          config.ensureState(state, blockId, config.embeddedTitle, options);
          return {
            type: 'blockDocumentStatefulBlock',
            attrs: {
              id: blockId,
              blockType: config.artifactType,
              blockInstanceId: blockId,
              ownership: 'owned',
              title: config.embeddedTitle,
              caption: '',
              ...(config.resizableHeight
                ? {height: config.defaultHeight ?? 560}
                : {}),
            },
          };
        },
      };
    },
  );
}

export function createStatefulBlockCommandTypes({
  experimentalEnabled = false,
}: {
  experimentalEnabled?: boolean;
} = {}): BlockDocumentStatefulBlockCommandType<RoomState>[] {
  return getEnabledStatefulBlockArtifactTypes(experimentalEnabled).map(
    (artifactType) => {
      const config = getStatefulBlockArtifactConfig(artifactType);
      return {
        blockType: config.artifactType,
        label: config.label,
        description: config.embeddedDescription,
        defaultTitle: config.embeddedTitle,
        defaultHeight: config.defaultHeight,
        ensureState: ({state, blockInstanceId, title}) => {
          config.ensureState(state, blockInstanceId, title);
        },
      };
    },
  );
}
