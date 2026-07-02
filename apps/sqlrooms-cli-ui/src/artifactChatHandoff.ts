import {
  createArtifactAiChatHandoffController,
  type ArtifactAiChatHandoffTargetForkContext,
} from '@sqlrooms/artifacts/ai';
import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentBlockType,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import {CLI_ARTIFACT_TYPES} from './artifactTypeIds';
import type {RoomState} from './store-types';

const SUPPORTED_HANDOFF_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

function isSameChartRequest(text: string) {
  const normalized = text.toLowerCase();
  return (
    /\bsame\s+chart\b/.test(normalized) ||
    /\bcopy\s+(?:the\s+)?chart\b/.test(normalized) ||
    /\bduplicate\s+(?:the\s+)?chart\b/.test(normalized)
  );
}

function cloneChartBlocks(blocks: BlockDocumentBlockType[]) {
  return blocks
    .filter((block) => block.type === 'chart')
    .map((block) => ({
      ...structuredClone(block),
      id: createDefaultBlockDocumentBlockId(),
    })) as BlockDocumentBlockType[];
}

function copySourceChartBlocksToEmptyBlockDocumentTarget(
  state: RoomState,
  sourceArtifactId: string,
  targetArtifactId: string,
) {
  const targetBlocks = state.blockDocuments.getBlocks(targetArtifactId);
  if (targetBlocks.length > 0) return;

  const chartBlocks = cloneChartBlocks(
    state.blockDocuments.getBlocks(sourceArtifactId),
  );
  if (chartBlocks.length === 0) return;

  state.blockDocuments.appendBlocks(targetArtifactId, chartBlocks);
}

function copySourceChartBlocksForSameChartBlockDocumentRequest({
  state,
  sourceArtifact,
  sourceUserMessage,
  targetArtifact,
}: ArtifactAiChatHandoffTargetForkContext<RoomState>) {
  if (!isSameChartRequest(sourceUserMessage.text)) return;
  if (
    sourceArtifact.type !== 'worksheet' ||
    targetArtifact.type !== 'worksheet'
  ) {
    return;
  }

  // Temporary product fallback until the agent can clone block document blocks
  // through the normal command/tool surface during the handoff turn.
  copySourceChartBlocksToEmptyBlockDocumentTarget(
    state,
    sourceArtifact.id,
    targetArtifact.id,
  );
}

/**
 * Creates the CLI policy wrapper around generic artifact AI chat handoff.
 *
 * The package controller owns artifact/session handoff mechanics. The CLI app
 * keeps block-document content policy, such as the temporary "same chart"
 * copy fallback for worksheet artifacts.
 */
export function createArtifactChatHandoffController(
  store: StoreApi<RoomState>,
) {
  return createArtifactAiChatHandoffController<RoomState>({
    store,
    isSupportedArtifact: (artifact) =>
      SUPPORTED_HANDOFF_ARTIFACT_TYPES.has(artifact.type),
    onBeforeTargetFork: copySourceChartBlocksForSameChartBlockDocumentRequest,
  });
}
