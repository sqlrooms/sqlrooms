import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import type {
  CommitHtmlAppRevisionMetadata,
  HtmlAppRevision,
  HtmlAppRevisionPatch,
  HtmlAppState,
  RestoreHtmlAppRevisionMetadata,
} from './html-app';

export const HTML_APP_WRITE_REVISION_COMMAND_ID = 'html-app.write-revision';
export const HTML_APP_RENAME_COMMAND_ID = 'html-app.rename';
export const HTML_APP_RESTORE_REVISION_COMMAND_ID = 'html-app.restore-revision';
export const HTML_APP_UNDO_REVISION_COMMAND_ID = 'html-app.undo-revision';
export const HTML_APP_REDO_REVISION_COMMAND_ID = 'html-app.redo-revision';

export const HTML_APP_REVISION_COMMAND_IDS = {
  writeRevision: HTML_APP_WRITE_REVISION_COMMAND_ID,
  rename: HTML_APP_RENAME_COMMAND_ID,
  restoreRevision: HTML_APP_RESTORE_REVISION_COMMAND_ID,
  undoRevision: HTML_APP_UNDO_REVISION_COMMAND_ID,
  redoRevision: HTML_APP_REDO_REVISION_COMMAND_ID,
} as const;

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
  HtmlAppRevisionCommandInput.unwrap().extend({
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

export type CreateHtmlAppRevisionCommandsOptions<
  TRoomState extends BaseRoomStoreState,
> = {
  /** Resolve the current host-selected HTML app id, when any. */
  resolveCurrentAppId?: (state: TRoomState) => string | undefined;
  /** Return all HTML app ids known to the host. */
  getHtmlAppIds: (state: TRoomState) => string[];
  /** Return an HTML app by id. */
  getHtmlAppState: (
    state: TRoomState,
    appId: string,
  ) => HtmlAppState | undefined;
  /** Rename an HTML app without committing source files. */
  renameHtmlApp: (state: TRoomState, appId: string, title: string) => void;
  /** Commit a durable HTML app revision. */
  commitHtmlAppRevision: (
    state: TRoomState,
    appId: string,
    patch: HtmlAppRevisionPatch,
    metadata?: CommitHtmlAppRevisionMetadata,
  ) => HtmlAppRevision | undefined;
  /** Restore a durable HTML app revision by id. */
  restoreHtmlAppRevision: (
    state: TRoomState,
    appId: string,
    revisionId: string,
    metadata?: RestoreHtmlAppRevisionMetadata,
  ) => HtmlAppRevision | undefined;
  /** Move backward through HTML app revisions. */
  undoHtmlAppRevision: (
    state: TRoomState,
    appId: string,
  ) => HtmlAppRevision | undefined;
  /** Move forward through undone HTML app revisions. */
  redoHtmlAppRevision: (
    state: TRoomState,
    appId: string,
  ) => HtmlAppRevision | undefined;
  /** Error message used when no app id can be chosen unambiguously. */
  ambiguousTargetMessage?: string;
};

function resolveHtmlAppCommandAppId<TRoomState extends BaseRoomStoreState>(
  state: TRoomState,
  options: CreateHtmlAppRevisionCommandsOptions<TRoomState>,
  inputAppId?: string,
) {
  if (inputAppId) {
    if (!options.getHtmlAppState(state, inputAppId)) {
      throw new Error(`HTML app "${inputAppId}" was not found.`);
    }
    return inputAppId;
  }

  const currentAppId = options.resolveCurrentAppId?.(state);
  if (currentAppId && options.getHtmlAppState(state, currentAppId)) {
    return currentAppId;
  }

  const appIds = options.getHtmlAppIds(state);
  if (appIds.length === 1 && appIds[0]) {
    return appIds[0];
  }

  throw new Error(
    options.ambiguousTargetMessage ??
      'No unambiguous HTML app target. Provide appId.',
  );
}

/**
 * Create room commands for writing, renaming, restoring, undoing, and redoing
 * HTML app revisions.
 */
export function createHtmlAppRevisionCommands<
  TRoomState extends BaseRoomStoreState,
>(
  options: CreateHtmlAppRevisionCommandsOptions<TRoomState>,
): RoomCommand<TRoomState>[] {
  return [
    {
      id: HTML_APP_WRITE_REVISION_COMMAND_ID,
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
        const app = options.getHtmlAppState(state, appId);
        if (!app) {
          throw new Error(`HTML app "${appId}" was not found.`);
        }
        const revision = options.commitHtmlAppRevision(
          state,
          appId,
          patch as HtmlAppRevisionPatch,
          (metadata ?? {}) as CommitHtmlAppRevisionMetadata,
        );
        if (!revision) {
          throw new Error(`Failed to write HTML app revision for "${appId}".`);
        }
        const nextApp = options.getHtmlAppState(state, appId);
        return {
          success: true,
          commandId: HTML_APP_WRITE_REVISION_COMMAND_ID,
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
      id: HTML_APP_RENAME_COMMAND_ID,
      name: 'Rename HTML app',
      description:
        'Rename an HTML app runtime and optionally commit title-updated files.',
      group: 'HTML App',
      keywords: ['html-app', 'rename', 'title'],
      inputSchema: HtmlAppRenameCommandInput,
      inputDescription: 'Provide appId, title, optional files, and metadata.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const state = getState();
        const {appId, title, files, metadata} =
          input as HtmlAppRenameCommandInput;
        const app = options.getHtmlAppState(state, appId);
        if (!app) {
          throw new Error(`HTML app "${appId}" was not found.`);
        }
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          throw new Error('HTML app title cannot be empty.');
        }
        const previousTitle = app.title;
        let revision;
        const shouldCommitRevision =
          files || (metadata && previousTitle !== trimmedTitle);
        if (shouldCommitRevision) {
          revision = options.commitHtmlAppRevision(
            state,
            appId,
            {
              title: trimmedTitle,
              ...(files ? {files, diagnostics: []} : {}),
            },
            (metadata ?? {}) as CommitHtmlAppRevisionMetadata,
          );
          if (!revision) {
            throw new Error(`Failed to rename HTML app "${appId}".`);
          }
        } else if (previousTitle !== trimmedTitle) {
          options.renameHtmlApp(state, appId, trimmedTitle);
        }
        const nextApp = options.getHtmlAppState(state, appId);
        return {
          success: true,
          commandId: HTML_APP_RENAME_COMMAND_ID,
          code:
            previousTitle === trimmedTitle && !files
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
      id: HTML_APP_RESTORE_REVISION_COMMAND_ID,
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
        const appId = resolveHtmlAppCommandAppId(state, options, inputAppId);
        const revision = options.restoreHtmlAppRevision(
          state,
          appId,
          revisionId,
        );
        if (!revision) {
          throw new Error(
            `Revision "${revisionId}" was not found for HTML app "${appId}".`,
          );
        }
        return {
          success: true,
          commandId: HTML_APP_RESTORE_REVISION_COMMAND_ID,
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
      id: HTML_APP_UNDO_REVISION_COMMAND_ID,
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
        const appId = resolveHtmlAppCommandAppId(state, options, inputAppId);
        const revision = options.undoHtmlAppRevision(state, appId);
        if (!revision) {
          throw new Error(`HTML app "${appId}" has no revision to undo.`);
        }
        return {
          success: true,
          commandId: HTML_APP_UNDO_REVISION_COMMAND_ID,
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
      id: HTML_APP_REDO_REVISION_COMMAND_ID,
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
        const appId = resolveHtmlAppCommandAppId(state, options, inputAppId);
        const revision = options.redoHtmlAppRevision(state, appId);
        if (!revision) {
          throw new Error(`HTML app "${appId}" has no revision to redo.`);
        }
        return {
          success: true,
          commandId: HTML_APP_REDO_REVISION_COMMAND_ID,
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
