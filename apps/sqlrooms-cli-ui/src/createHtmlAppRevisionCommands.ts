import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';

import type {RoomState} from './store-types';

export const HTML_APP_REVISION_COMMAND_OWNER =
  '@sqlrooms-cli-ui/html-app-revisions';

const HtmlAppRevisionCommandInput = z
  .object({
    appId: z.string().optional().describe('Target HTML app runtime id.'),
    revisionId: z
      .string()
      .optional()
      .describe('Target revision id for restore.'),
  })
  .default({});
type HtmlAppRevisionCommandInput = z.infer<typeof HtmlAppRevisionCommandInput>;

const HtmlAppRestoreRevisionCommandInput =
  HtmlAppRevisionCommandInput.removeDefault().extend({
    revisionId: z.string().describe('Target revision id for restore.'),
  });
type HtmlAppRestoreRevisionCommandInput = z.infer<
  typeof HtmlAppRestoreRevisionCommandInput
>;

/**
 * Create room commands for restoring, undoing, and redoing HTML app revisions.
 */
export function createHtmlAppRevisionCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: 'html-app.restore-revision',
      name: 'Restore HTML app revision',
      description: 'Restore an HTML app to a persisted source revision',
      group: 'HTML App',
      keywords: ['html-app', 'revision', 'restore', 'history'],
      inputSchema: HtmlAppRestoreRevisionCommandInput,
      inputDescription: 'Provide revisionId and optionally appId.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId: inputAppId, revisionId} =
          input as HtmlAppRestoreRevisionCommandInput;
        const appId = resolveHtmlAppCommandAppId(state, inputAppId);
        const revision = state.htmlApps.restoreAppRevision(appId, revisionId);
        if (!revision) {
          throw new Error(
            `Revision "${revisionId}" was not found for HTML app "${appId}".`,
          );
        }
        return {
          success: true,
          commandId: 'html-app.restore-revision',
          message: `Restored HTML app revision "${revision.name}".`,
          data: {
            appId,
            revisionId: revision.id,
            revisionName: revision.name,
          },
        };
      },
    },
    {
      id: 'html-app.undo-revision',
      name: 'Undo HTML app revision',
      description: 'Move an HTML app back to its previous source revision',
      group: 'HTML App',
      keywords: ['html-app', 'revision', 'undo', 'history'],
      inputSchema: HtmlAppRevisionCommandInput,
      inputDescription: 'Optionally provide appId.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId: inputAppId} =
          ((input as HtmlAppRevisionCommandInput | undefined) ?? {}) || {};
        const appId = resolveHtmlAppCommandAppId(state, inputAppId);
        const revision = state.htmlApps.undoAppRevision(appId);
        if (!revision) {
          throw new Error(`HTML app "${appId}" has no revision to undo.`);
        }
        return {
          success: true,
          commandId: 'html-app.undo-revision',
          message: `Undid to HTML app revision "${revision.name}".`,
          data: {
            appId,
            revisionId: revision.id,
            revisionName: revision.name,
          },
        };
      },
    },
    {
      id: 'html-app.redo-revision',
      name: 'Redo HTML app revision',
      description: 'Move an HTML app forward through undone source revisions',
      group: 'HTML App',
      keywords: ['html-app', 'revision', 'redo', 'history'],
      inputSchema: HtmlAppRevisionCommandInput,
      inputDescription: 'Optionally provide appId.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId: inputAppId} =
          ((input as HtmlAppRevisionCommandInput | undefined) ?? {}) || {};
        const appId = resolveHtmlAppCommandAppId(state, inputAppId);
        const revision = state.htmlApps.redoAppRevision(appId);
        if (!revision) {
          throw new Error(`HTML app "${appId}" has no revision to redo.`);
        }
        return {
          success: true,
          commandId: 'html-app.redo-revision',
          message: `Redid to HTML app revision "${revision.name}".`,
          data: {
            appId,
            revisionId: revision.id,
            revisionName: revision.name,
          },
        };
      },
    },
  ];
}

function resolveHtmlAppCommandAppId(state: RoomState, inputAppId?: string) {
  if (inputAppId) {
    if (!state.htmlApps.getApp(inputAppId)) {
      throw new Error(`HTML app "${inputAppId}" was not found.`);
    }
    return inputAppId;
  }

  const currentArtifactId = state.artifacts.config.currentArtifactId;
  const currentArtifact = currentArtifactId
    ? state.artifacts.config.artifactsById[currentArtifactId]
    : undefined;
  if (
    currentArtifactId &&
    currentArtifact?.type === 'html-app' &&
    state.htmlApps.getApp(currentArtifactId)
  ) {
    return currentArtifactId;
  }

  const appIds = Object.keys(state.htmlApps.config.appsById);
  if (appIds.length === 1 && appIds[0]) {
    return appIds[0];
  }

  throw new Error(
    'No unambiguous HTML app target. Provide appId or select a top-level html-app artifact.',
  );
}
