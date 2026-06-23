import type {
  CommitHtmlAppRevisionMetadata,
  HtmlAppRevisionPatch,
} from '@sqlrooms/app-runtime';
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

const HtmlAppRevisionPatchInput = z.object({
  title: z.string().optional(),
  intent: z.string().optional(),
  files: z.record(z.string(), z.string()).optional(),
  entryHtmlPath: z.string().optional(),
  dependencies: z.array(z.unknown()).optional(),
  requestedCapabilities: z.array(z.string()).optional(),
  grantedCapabilities: z.array(z.string()).optional(),
  diagnostics: z.array(z.unknown()).optional(),
});

const HtmlAppRevisionMetadataInput = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    source: z.enum(['assistant', 'user', 'system', 'restore']).optional(),
    sourcePrompt: z.string().optional(),
    sessionId: z.string().optional(),
    toolCallId: z.string().optional(),
    commitGroupId: z.string().optional(),
    parentRevisionId: z.string().optional(),
    createdAt: z.number().optional(),
    revisionId: z.string().optional(),
    clearRedo: z.boolean().optional(),
  })
  .default({});

const HtmlAppWriteRevisionCommandInput = z.object({
  appId: z.string().describe('Target HTML app runtime id.'),
  patch: HtmlAppRevisionPatchInput.describe('Durable HTML app state patch.'),
  metadata: HtmlAppRevisionMetadataInput.optional(),
});
type HtmlAppWriteRevisionCommandInput = z.infer<
  typeof HtmlAppWriteRevisionCommandInput
>;

const HtmlAppRenameCommandInput = z.object({
  appId: z.string().describe('Target HTML app runtime id.'),
  title: z.string().min(1).describe('New HTML app title.'),
  files: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional source files with title updates already applied.'),
  metadata: HtmlAppRevisionMetadataInput.optional(),
});
type HtmlAppRenameCommandInput = z.infer<typeof HtmlAppRenameCommandInput>;

/**
 * Create room commands for restoring, undoing, and redoing HTML app revisions.
 */
export function createHtmlAppRevisionCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: 'html-app.write-revision',
      name: 'Write HTML app revision',
      description: 'Commit a durable source revision for an HTML app.',
      group: 'HTML App',
      keywords: ['html-app', 'revision', 'write', 'commit'],
      inputSchema: HtmlAppWriteRevisionCommandInput,
      inputDescription: 'Provide appId, patch, and optional revision metadata.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId, patch, metadata} =
          input as HtmlAppWriteRevisionCommandInput;
        const app = state.htmlApps.getApp(appId);
        if (!app) {
          throw new Error(`HTML app "${appId}" was not found.`);
        }
        const revision = state.htmlApps.commitAppRevision(
          appId,
          patch as HtmlAppRevisionPatch,
          (metadata ?? {}) as CommitHtmlAppRevisionMetadata,
        );
        if (!revision) {
          throw new Error(`Failed to write HTML app revision for "${appId}".`);
        }
        const nextApp = state.htmlApps.getApp(appId);
        return {
          success: true,
          commandId: 'html-app.write-revision',
          message: `Wrote HTML app revision "${revision.name}".`,
          data: {
            appId,
            title: nextApp?.title ?? app.title,
            revisionId: revision.id,
            revisionName: revision.name,
            revision,
            filePaths: Object.keys(nextApp?.files ?? app.files),
            diagnostics: nextApp?.diagnostics ?? app.diagnostics,
          },
        };
      },
    },
    {
      id: 'html-app.rename',
      name: 'Rename HTML app',
      description:
        'Rename an HTML app runtime and optionally commit title-updated files.',
      group: 'HTML App',
      keywords: ['html-app', 'rename', 'title'],
      inputSchema: HtmlAppRenameCommandInput,
      inputDescription: 'Provide appId, title, optional files, and metadata.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId, title, files, metadata} =
          input as HtmlAppRenameCommandInput;
        const app = state.htmlApps.getApp(appId);
        if (!app) {
          throw new Error(`HTML app "${appId}" was not found.`);
        }
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          throw new Error('HTML app title cannot be empty.');
        }
        const previousTitle = app.title;
        let revision;
        if (files) {
          revision = state.htmlApps.commitAppRevision(
            appId,
            {
              title: trimmedTitle,
              files,
              diagnostics: [],
            },
            (metadata ?? {}) as CommitHtmlAppRevisionMetadata,
          );
          if (!revision) {
            throw new Error(`Failed to rename HTML app "${appId}".`);
          }
        } else if (app.title !== trimmedTitle) {
          state.htmlApps.renameApp(appId, trimmedTitle);
        }
        const nextApp = state.htmlApps.getApp(appId);
        return {
          success: true,
          commandId: 'html-app.rename',
          code:
            app.title === trimmedTitle && !files
              ? 'html-app-title-unchanged'
              : undefined,
          message: `Renamed HTML app "${appId}" to "${trimmedTitle}".`,
          data: {
            appId,
            previousTitle,
            title: nextApp?.title ?? trimmedTitle,
            revisionId: revision?.id,
            revisionName: revision?.name,
            revision,
            filePaths: Object.keys(nextApp?.files ?? app.files),
            diagnostics: nextApp?.diagnostics ?? app.diagnostics,
          },
        };
      },
    },
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
