import type {JsonObject, JsonValue} from '@sqlrooms/evals';
import {getTableIdentity} from '@sqlrooms/duckdb';
import type {RoomState} from '../store-types';

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** Captures the durable CLI state used by target-neutral behavioral oracles. */
export function snapshotCliEvalState(state: RoomState): JsonObject {
  const documents = Object.values(state.artifacts.config.artifactsById)
    .filter((artifact) => artifact.type === 'document')
    .map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      blocks: state.blockDocuments.getBlocks(artifact.id),
    }));
  const maps = Object.values(state.deckMaps.config.mapsById);
  return {
    artifacts: toJsonValue(state.artifacts.config),
    documents: toJsonValue(documents),
    maps: toJsonValue(maps),
    tables: state.db.tables.map((table) => getTableIdentity(table.table)),
  };
}
