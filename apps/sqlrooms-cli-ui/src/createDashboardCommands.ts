import type {RoomCommand} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {z} from 'zod';

import {RoomState} from './store-types';

type CliArtifactType =
  | 'analysis'
  | 'dashboard'
  | 'pivot'
  | 'notebook'
  | 'document'
  | 'canvas'
  | 'app';

export const DASHBOARD_COMMAND_OWNER = '@sqlrooms-cli-ui/dashboard';

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
    execute: ({getState}, input) => {
      const {title} = (input as CreateArtifactCommandInput | undefined) ?? {};
      const state = getState();
      const artifactId = state.artifacts.createArtifact({
        type: artifactType,
        title: getUniqueArtifactTitle(state, title ?? group),
      });
      if (artifactType === 'notebook') {
        state.notebook.ensureArtifact(artifactId);
      } else if (artifactType === 'analysis') {
        state.blockDocuments.ensureBlockDocument(artifactId);
      } else if (artifactType === 'document') {
        state.documents.ensureDocument(artifactId);
      } else if (artifactType === 'canvas') {
        state.canvas.ensureArtifact(artifactId);
      } else if (artifactType === 'pivot') {
        state.pivot.ensurePivot(artifactId, {title: title ?? group});
      }
      state.artifacts.setCurrentArtifact(artifactId);
      return {
        success: true,
        commandId: id,
        message: `Created ${group.toLowerCase()} artifact "${artifactId}".`,
        data: {artifactId},
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
    execute: ({getState}, input) => {
      const {title, layoutType} = input as DashboardCreateArtifactCommandInput;
      const state = getState();
      const artifactId = state.dashboard.createDashboardArtifact(
        getUniqueArtifactTitle(state, title ?? 'Dashboard'),
        layoutType,
      );
      state.artifacts.setCurrentArtifact(artifactId);
      return {
        success: true,
        commandId: 'dashboard.create-artifact',
        message: `Created dashboard artifact "${artifactId}".`,
        data: {artifactId},
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createDashboardCommands(): RoomCommand<RoomState>[] {
  return [
    // Universal select (works for any artifact type)
    {
      id: 'artifact.select',
      name: 'Select artifact',
      description: 'Switch to an existing artifact by ID',
      group: 'Artifacts',
      keywords: ['artifact', 'select', 'switch'],
      inputSchema: SelectArtifactCommandInput,
      inputDescription: 'Provide the artifact ID.',
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
        if (artifact.type === 'analysis') {
          state.blockDocuments.ensureBlockDocument(artifactId);
        }
        if (artifact.type === 'document') {
          state.documents.ensureDocument(artifactId);
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
        return {
          success: true,
          commandId: 'artifact.select',
          message: `Selected artifact "${artifactId}".`,
        };
      },
    },

    // Per-type create commands
    createArtifactCommand('analysis', 'Analysis'),
    createArtifactCommand('pivot', 'Pivot Table'),
    createArtifactCommand('notebook', 'Notebook'),
    createArtifactCommand('document', 'Document'),
    createArtifactCommand('canvas', 'Canvas'),
    createArtifactCommand('app', 'App'),
    createDashboardCreateArtifactCommand(),
  ];
}
