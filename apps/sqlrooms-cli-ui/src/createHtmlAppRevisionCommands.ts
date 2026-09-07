import {
  createHtmlAppRevisionCommands as createRuntimeHtmlAppRevisionCommands,
  type CommitHtmlAppRevisionMetadata,
  type HtmlAppRevisionPatch,
  type RestoreHtmlAppRevisionMetadata,
} from '@sqlrooms/app-runtime';
import {resolveArtifactTargetId} from '@sqlrooms/artifacts';
import type {RoomCommand} from '@sqlrooms/room-shell';
import type {RoomState} from './store-types';

export const HTML_APP_REVISION_COMMAND_OWNER =
  '@sqlrooms-cli-ui/html-app-revisions';

/**
 * Create room commands for restoring, undoing, and redoing HTML app revisions.
 */
export function createHtmlAppRevisionCommands(): RoomCommand<RoomState>[] {
  return createRuntimeHtmlAppRevisionCommands<RoomState>({
    resolveCurrentAppId: (state, context) => {
      const artifactId = resolveArtifactTargetId({
        invocation: context.invocation,
        currentArtifactId: state.artifacts.config.currentArtifactId,
      });
      const currentArtifact = artifactId
        ? state.artifacts.config.artifactsById[artifactId]
        : undefined;
      return currentArtifact?.type === 'html-app' ? artifactId : undefined;
    },
    getHtmlAppIds: (state) => Object.keys(state.htmlApps.config.appsById),
    getHtmlAppState: (state, appId) => state.htmlApps.getApp(appId),
    renameHtmlApp: (state, appId, title) =>
      state.htmlApps.renameApp(appId, title),
    commitHtmlAppRevision: (state, appId, patch, metadata) =>
      state.htmlApps.commitAppRevision(
        appId,
        patch as HtmlAppRevisionPatch,
        metadata as CommitHtmlAppRevisionMetadata,
      ),
    restoreHtmlAppRevision: (state, appId, revisionId, metadata) =>
      state.htmlApps.restoreAppRevision(
        appId,
        revisionId,
        metadata as RestoreHtmlAppRevisionMetadata,
      ),
    undoHtmlAppRevision: (state, appId) =>
      state.htmlApps.undoAppRevision(appId),
    redoHtmlAppRevision: (state, appId) =>
      state.htmlApps.redoAppRevision(appId),
    ambiguousTargetMessage:
      'No unambiguous HTML app target. Provide appId or select a top-level html-app artifact.',
  });
}
