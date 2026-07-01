/**
 * {@include ../README.md}
 * @packageDocumentation
 */

import {parseQualifiedSqlIdentifier} from '@sqlrooms/duckdb-core';
import z from 'zod';

/**
 * Strip the leading database segment from a Kepler dataset id, if present.
 *
 * Kepler dataset ids used to be full three-part SQL references, including a
 * database name that changes when the project file is renamed. Non-main-DB
 * layers are not supported anyway, so on load we normalize to schema-qualified
 * ids so saved configs stay portable across renames.
 */
function stripDatabaseFromKeplerDatasetId(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parsed = parseQualifiedSqlIdentifier(value);
  if (!parsed?.database || !parsed.schema || !parsed.table) return value;
  const escape = (id: string) => `"${id.replace(/"/g, '""')}"`;
  return `${escape(parsed.schema)}.${escape(parsed.table)}`;
}

/**
 * Walk saved kepler layers/filters and normalize their `dataId` fields.
 * Passthrough of visState means kepler-config never inspects layer internals,
 * so we run this migration explicitly during preprocessing.
 */
function migrateVisStateDataIds(visState: unknown): unknown {
  if (!visState || typeof visState !== 'object') return visState;
  const state = visState as Record<string, unknown>;

  const layers = state.layers;
  if (Array.isArray(layers)) {
    state.layers = layers.map((layer) => {
      if (!layer || typeof layer !== 'object') return layer;
      const layerObj = layer as Record<string, unknown>;
      const config = layerObj.config;
      if (config && typeof config === 'object') {
        const configObj = config as Record<string, unknown>;
        if (typeof configObj.dataId === 'string') {
          configObj.dataId = stripDatabaseFromKeplerDatasetId(configObj.dataId);
        }
      }
      return layerObj;
    });
  }

  const filters = state.filters;
  if (Array.isArray(filters)) {
    state.filters = filters.map((filter) => {
      if (!filter || typeof filter !== 'object') return filter;
      const filterObj = filter as Record<string, unknown>;
      const dataId = filterObj.dataId;
      if (Array.isArray(dataId)) {
        filterObj.dataId = dataId.map((id) =>
          typeof id === 'string' ? stripDatabaseFromKeplerDatasetId(id) : id,
        );
      } else if (typeof dataId === 'string') {
        filterObj.dataId = stripDatabaseFromKeplerDatasetId(dataId);
      }
      return filterObj;
    });
  }

  return state;
}

const KeplerMapConfigSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object') return val;
    const draft = {...(val as Record<string, unknown>)};
    const inner = draft.config;
    if (inner && typeof inner === 'object') {
      const innerDraft = {...(inner as Record<string, unknown>)};
      innerDraft.visState = migrateVisStateDataIds(innerDraft.visState);
      draft.config = innerDraft;
    }
    return draft;
  },
  z.object({
    version: z.literal('v1'),
    config: z.object({
      visState: z.object({}).passthrough(),
      mapState: z.object({}).passthrough(),
      mapStyle: z.object({}).passthrough(),
      uiState: z.object({}).passthrough(),
    }),
  }),
);

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastOpenedAt: z.number().optional(),
  config: KeplerMapConfigSchema.optional(),
});
export type KeplerMapSchema = z.infer<typeof KeplerMapSchema>;

const LegacyKeplerSliceConfig = z.object({
  currentMapId: z.string().optional(),
  maps: z.array(KeplerMapSchema).default([]),
  openTabs: z.array(z.string()).optional(),
});

export const KeplerSliceConfig = z.preprocess(
  (val) => val,
  z.object({
    maps: z.array(KeplerMapSchema).default([]),
  }),
);
export type KeplerSliceConfig = z.infer<typeof KeplerSliceConfig>;

export type KeplerTabsArtifactsMigrationOptions = {
  artifactType?: string;
};

export function migrateKeplerTabsToArtifacts(
  input: unknown,
  options: KeplerTabsArtifactsMigrationOptions = {},
) {
  const legacyConfig = LegacyKeplerSliceConfig.parse(input);
  const artifactType = options.artifactType ?? 'kepler-map';
  const mapIds = legacyConfig.maps.map((map) => map.id);
  const knownMapIds = new Set(mapIds);
  const openTabs =
    legacyConfig.openTabs?.filter((mapId) => knownMapIds.has(mapId)) ?? mapIds;
  const openTabSet = new Set(openTabs);
  const currentArtifactId =
    legacyConfig.currentMapId && knownMapIds.has(legacyConfig.currentMapId)
      ? legacyConfig.currentMapId
      : (openTabs[0] ?? mapIds[0]);

  return {
    keplerConfig: KeplerSliceConfig.parse({
      maps: legacyConfig.maps,
    }),
    artifactsConfig: {
      artifactsById: Object.fromEntries(
        legacyConfig.maps.map((map) => [
          map.id,
          {
            id: map.id,
            type: artifactType,
            title: map.name,
          },
        ]),
      ),
      artifactOrder: mapIds,
      currentArtifactId,
    },
    hiddenArtifactIds: mapIds.filter((mapId) => !openTabSet.has(mapId)),
  };
}
