import type {ArtifactTypeDefinition} from '@sqlrooms/artifacts';
import type {
  RoomCommand,
  RoomCommandExecutionContext,
} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {z} from 'zod';

import type {CliArtifactType} from './artifactTypeIds';
import {RoomState} from './store-types';

export const DASHBOARD_COMMAND_OWNER = '@sqlrooms-cli-ui/dashboard';

type CreateDashboardCommandsOptions = {
  artifactTypes?: Partial<
    Record<
      CliArtifactType,
      Pick<ArtifactTypeDefinition<RoomState>, 'canCreate'>
    >
  >;
};

// ---------------------------------------------------------------------------
// Shared input schemas for generic artifact commands
// ---------------------------------------------------------------------------

const CreateArtifactCommandInput = z
  .object({
    title: z.string().optional().describe('Optional artifact title.'),
  })
  .default({});
type CreateArtifactCommandInput = z.infer<typeof CreateArtifactCommandInput>;

const DashboardCreateArtifactCommandInput = z.object({
  title: z.string().optional().describe('Optional artifact title.'),
  layoutType: z
    .enum(['dock', 'grid'])
    .optional()
    .default('grid')
    .describe('Dashboard layout node type to use at creation time.'),
});
type DashboardCreateArtifactCommandInput = z.infer<
  typeof DashboardCreateArtifactCommandInput
>;

const SelectArtifactCommandInput = z
  .object({
    artifactId: z.string().optional().describe('Target artifact ID.'),
  })
  .refine((value) => value.artifactId, {
    message: 'Provide artifactId.',
  });
type SelectArtifactCommandInput = z.infer<typeof SelectArtifactCommandInput>;

const RenameArtifactCommandInput = z.object({
  artifactId: z.string().describe('Target artifact ID.'),
  title: z.string().describe('New artifact title.'),
});
type RenameArtifactCommandInput = z.infer<typeof RenameArtifactCommandInput>;

// ---------------------------------------------------------------------------
// Generic create-artifact helper per artifact type
// ---------------------------------------------------------------------------

function getUniqueArtifactTitle(state: RoomState, baseTitle: string) {
  return generateUniqueName(
    baseTitle,
    Object.values(state.artifacts.config.artifactsById).map(
      (artifact) => artifact.title,
    ),
    ' ',
  );
}

function shouldCreateInitialArtifactChat(
  context: RoomCommandExecutionContext<RoomState>,
) {
  return !['ai', 'mcp'].includes(context.invocation.surface);
}

function createArtifactCommand(
  artifactType: CliArtifactType,
  group: string,
): RoomCommand<RoomState> {
  const id = `${artifactType}.create-artifact`;
  return {
    id,
    name: `Create ${group.toLowerCase()} artifact`,
    description: `Create a new ${group.toLowerCase()} artifact and select it`,
    group,
    keywords: [artifactType, 'artifact', 'create', 'new'],
    inputSchema: CreateArtifactCommandInput,
    inputDescription: `Optional title for the ${group.toLowerCase()} artifact.`,
    metadata: {
      readOnly: false,
      idempotent: false,
      riskLevel: 'low',
    },
    execute: (context, input) => {
      const {getState} = context;
      const {title} = (input as CreateArtifactCommandInput | undefined) ?? {};
      const state = getState();
      const uniqueTitle = getUniqueArtifactTitle(state, title ?? group);
      const artifactId = state.artifacts.createArtifact({
        type: artifactType,
        title: uniqueTitle,
      });
      if (artifactType === 'notebook') {
        state.notebook.ensureArtifact(artifactId);
      } else if (artifactType === 'worksheet') {
        state.blockDocuments.ensureBlockDocument(artifactId);
      } else if (artifactType === 'document') {
        state.documents.ensureDocument(artifactId);
      } else if (artifactType === 'sql-query') {
        state.sqlEditor.ensureQuery(artifactId, {name: uniqueTitle});
      } else if (artifactType === 'canvas') {
        state.canvas.ensureArtifact(artifactId);
      } else if (artifactType === 'pivot') {
        state.pivot.ensurePivot(artifactId, {title: uniqueTitle});
      } else if (artifactType === 'python') {
        state.python.ensureBlock(artifactId, {title: uniqueTitle});
      }
      state.artifacts.setCurrentArtifact(artifactId);
      if (shouldCreateInitialArtifactChat(context)) {
        state.artifactAi.createArtifactScopedSession();
      }
      return {
        success: true,
        commandId: id,
        message: `Created ${group.toLowerCase()} artifact "${artifactId}".`,
        data: {
          artifactId,
          artifactTargetChange: {
            artifactId,
            artifactType,
            title: uniqueTitle,
            change: 'created',
            shouldContinueChat: true,
          },
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Dashboard-specific create command (uses dashboard slice for extra state)
// ---------------------------------------------------------------------------

function createDashboardCreateArtifactCommand(): RoomCommand<RoomState> {
  return {
    id: 'dashboard.create-artifact',
    name: 'Create dashboard artifact',
    description: 'Create a new dashboard artifact and select it',
    group: 'Dashboard',
    keywords: ['dashboard', 'artifact', 'create', 'new'],
    inputSchema: DashboardCreateArtifactCommandInput,
    inputDescription:
      'Optional dashboard layoutType ("dock" or "grid", defaults to "grid") and optional title.',
    metadata: {
      readOnly: false,
      idempotent: false,
      riskLevel: 'low',
    },
    execute: (context, input) => {
      const {getState} = context;
      const {title, layoutType} =
        (input as DashboardCreateArtifactCommandInput | undefined) ?? {};
      const state = getState();
      const artifactId = state.dashboard.createDashboardArtifact(
        getUniqueArtifactTitle(state, title ?? 'Dashboard'),
        layoutType,
      );
      state.artifacts.setCurrentArtifact(artifactId);
      if (shouldCreateInitialArtifactChat(context)) {
        state.artifactAi.createArtifactScopedSession();
      }
      return {
        success: true,
        commandId: 'dashboard.create-artifact',
        message: `Created dashboard artifact "${artifactId}".`,
        data: {
          artifactId,
          artifactTargetChange: {
            artifactId,
            artifactType: 'dashboard',
            title:
              state.artifacts.getArtifact(artifactId)?.title ??
              title ??
              'Dashboard',
            change: 'created',
            shouldContinueChat: true,
          },
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

const ARTIFACT_CREATE_COMMANDS: {
  artifactType: CliArtifactType;
  command: () => RoomCommand<RoomState>;
}[] = [
  {
    artifactType: 'worksheet',
    command: () => createArtifactCommand('worksheet', 'Worksheet'),
  },
  {
    artifactType: 'pivot',
    command: () => createArtifactCommand('pivot', 'Pivot Table'),
  },
  {
    artifactType: 'notebook',
    command: () => createArtifactCommand('notebook', 'Notebook'),
  },
  {
    artifactType: 'document',
    command: () => createArtifactCommand('document', 'Document'),
  },
  {
    artifactType: 'sql-query',
    command: () => createArtifactCommand('sql-query', 'SQL Query'),
  },
  {
    artifactType: 'html-app',
    command: () => createArtifactCommand('html-app', 'HTML App'),
  },
  {
    artifactType: 'python',
    command: () => createArtifactCommand('python', 'Python'),
  },
  {
    artifactType: 'canvas',
    command: () => createArtifactCommand('canvas', 'Canvas'),
  },
  {artifactType: 'app', command: () => createArtifactCommand('app', 'App')},
  {artifactType: 'dashboard', command: createDashboardCreateArtifactCommand},
];

function canCreateArtifactType(
  artifactTypes: CreateDashboardCommandsOptions['artifactTypes'],
  artifactType: CliArtifactType,
) {
  return artifactTypes?.[artifactType]?.canCreate !== false;
}

/**
 * Builds workspace-level dashboard commands, including per-artifact creation
 * commands filtered by artifact capability flags.
 *
 * @param options Optional command factory options.
 * @param options.artifactTypes Artifact capability definitions keyed by artifact
 * type. A type is creatable unless `canCreate` is explicitly `false`.
 * @returns Commands for selecting workspace artifacts and creating the artifact
 * types allowed by the provided capability map.
 */
export function createDashboardCommands({
  artifactTypes,
}: CreateDashboardCommandsOptions = {}): RoomCommand<RoomState>[] {
  return [
    // Universal select (works for any workspace item type)
    {
      id: 'artifact.select',
      name: 'Select item',
      description: 'Switch to an existing workspace item by ID',
      group: 'Workspace',
      keywords: ['item', 'workspace', 'select', 'switch'],
      inputSchema: SelectArtifactCommandInput,
      inputDescription: 'Provide the item ID.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        const artifactId = (input as SelectArtifactCommandInput).artifactId;
        if (!artifactId) {
          throw new Error('No artifactId provided.');
        }
        const artifact = getState().artifacts.getArtifact(artifactId);
        if (!artifact) {
          throw new Error(`Unknown artifact "${artifactId}".`);
        }
      },
      execute: ({getState}, input) => {
        const artifactId = (input as SelectArtifactCommandInput).artifactId;
        if (!artifactId) {
          throw new Error('No artifactId provided.');
        }
        const state = getState();
        const artifact = state.artifacts.getArtifact(artifactId);
        if (!artifact) {
          throw new Error(`Unknown artifact "${artifactId}".`);
        }
        state.artifacts.setCurrentArtifact(artifactId);
        if (artifact.type === 'notebook') {
          state.notebook.ensureArtifact(artifactId);
        }
        if (artifact.type === 'worksheet') {
          state.blockDocuments.ensureBlockDocument(artifactId);
        }
        if (artifact.type === 'document') {
          state.documents.ensureDocument(artifactId);
        }
        if (artifact.type === 'sql-query') {
          state.sqlEditor.ensureQuery(artifactId, {name: artifact.title});
        }
        if (artifact.type === 'canvas') {
          state.canvas.ensureArtifact(artifactId);
        }
        if (artifact.type === 'dashboard') {
          state.dashboard.ensureDashboardArtifact(artifactId);
        }
        if (artifact.type === 'pivot') {
          state.pivot.ensurePivot(artifactId, {title: artifact.title});
        }
        if (artifact.type === 'python') {
          state.python.ensureBlock(artifactId, {title: artifact.title});
        }
        return {
          success: true,
          commandId: 'artifact.select',
          message: `Selected artifact "${artifactId}".`,
          data: {
            artifactId,
            artifactTargetChange: {
              artifactId,
              artifactType: artifact.type,
              title: artifact.title,
              change: 'selected',
              shouldContinueChat: true,
            },
          },
        };
      },
    },
    {
      id: 'artifact.rename',
      name: 'Rename item',
      description: 'Rename an existing workspace item by ID',
      group: 'Workspace',
      keywords: ['item', 'workspace', 'rename', 'title'],
      inputSchema: RenameArtifactCommandInput,
      inputDescription: 'Provide the item ID and non-empty title.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        const {artifactId, title} = input as RenameArtifactCommandInput;
        if (!artifactId) {
          throw new Error('No artifactId provided.');
        }
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          throw new Error('Artifact title cannot be empty.');
        }
        const artifact = getState().artifacts.getArtifact(artifactId);
        if (!artifact) {
          throw new Error(`Unknown artifact "${artifactId}".`);
        }
      },
      execute: ({getState}, input) => {
        const {artifactId, title} = input as RenameArtifactCommandInput;
        const trimmedTitle = title.trim();
        const state = getState();
        const artifact = state.artifacts.getArtifact(artifactId);
        if (!artifact) {
          throw new Error(`Unknown artifact "${artifactId}".`);
        }
        if (!trimmedTitle) {
          throw new Error('Artifact title cannot be empty.');
        }
        const previousTitle = artifact.title;
        if (previousTitle === trimmedTitle) {
          return {
            success: true,
            commandId: 'artifact.rename',
            code: 'artifact-title-unchanged',
            message: `Artifact "${artifactId}" is already named "${trimmedTitle}".`,
            data: {
              artifactId,
              artifactType: artifact.type,
              previousTitle,
              title: trimmedTitle,
            },
          };
        }

        state.artifacts.renameArtifact(artifactId, trimmedTitle);
        const renamedArtifact = state.artifacts.getArtifact(artifactId);
        return {
          success: true,
          commandId: 'artifact.rename',
          message: `Renamed artifact "${artifactId}" to "${trimmedTitle}".`,
          data: {
            artifactId,
            artifactType: renamedArtifact?.type ?? artifact.type,
            previousTitle,
            title: renamedArtifact?.title ?? trimmedTitle,
          },
        };
      },
    },

    // Per-type create commands
    ...ARTIFACT_CREATE_COMMANDS.filter(({artifactType}) =>
      canCreateArtifactType(artifactTypes, artifactType),
    ).map(({command}) => command()),
  ];
}
