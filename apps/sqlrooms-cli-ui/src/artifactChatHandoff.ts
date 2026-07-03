import {createArtifactAiChatHandoffController} from '@sqlrooms/artifacts/ai';
import type {StoreApi} from 'zustand';
import {CLI_ARTIFACT_TYPES} from './artifactTypeIds';
import type {RoomState} from './store-types';

const SUPPORTED_HANDOFF_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

/**
 * Creates the CLI policy wrapper around generic artifact AI chat handoff.
 *
 * The package controller owns artifact/session handoff mechanics. Block
 * document content transfer is handled by explicit AI tools.
 */
export function createArtifactChatHandoffController(
  store: StoreApi<RoomState>,
) {
  return createArtifactAiChatHandoffController<RoomState>({
    store,
    isSupportedArtifact: (artifact) =>
      SUPPORTED_HANDOFF_ARTIFACT_TYPES.has(artifact.type),
  });
}
