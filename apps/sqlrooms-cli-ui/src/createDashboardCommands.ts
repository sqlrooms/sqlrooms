import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';

import {parseVgPlotSpecString} from './vgplot';
import {RoomState} from './store-types';

type CliArtifactType = 'dashboard' | 'notebook' | 'canvas' | 'app';

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

const SelectArtifactCommandInput = z
  .object({
    artifactId: z.string().optional().describe('Target artifact ID.'),
  })
  .refine((value) => value.artifactId, {
    message: 'Provide artifactId.',
  });
type SelectArtifactCommandInput = z.infer<typeof SelectArtifactCommandInput>;

// ---------------------------------------------------------------------------
// Dashboard-specific input schemas
// ---------------------------------------------------------------------------

const DashboardSetVgPlotCommandInput = z.object({
  artifactId: z
    .string()
    .optional()
    .describe(
      'Optional dashboard artifact ID. Defaults to the current dashboard.',
    ),
  vgplot: z
    .string()
    .describe('VgPlot JSON string for the dashboard specification.'),
});
type DashboardSetVgPlotCommandInput = z.infer<
  typeof DashboardSetVgPlotCommandInput
>;

const DashboardGetVgPlotCommandInput = z
  .object({
    artifactId: z
      .string()
      .optional()
      .describe(
        'Optional dashboard artifact ID. Defaults to the current dashboard.',
      ),
  })
  .default({});
type DashboardGetVgPlotCommandInput = z.infer<
  typeof DashboardGetVgPlotCommandInput
>;

// ---------------------------------------------------------------------------
// Generic create-artifact helper per artifact type
// ---------------------------------------------------------------------------

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
        title: title ?? group,
      });
      if (artifactType === 'notebook') {
        state.notebook.ensureArtifact(artifactId);
      } else if (artifactType === 'canvas') {
        state.canvas.ensureArtifact(artifactId);
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
    inputSchema: CreateArtifactCommandInput,
    inputDescription: 'Optional title for the dashboard artifact.',
    metadata: {
      readOnly: false,
      idempotent: false,
      riskLevel: 'low',
    },
    execute: ({getState}, input) => {
      const {title} = (input as CreateArtifactCommandInput | undefined) ?? {};
      const artifactId = getState().dashboard.createDashboardArtifact(title);
      getState().artifacts.setCurrentArtifact(artifactId);
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
        if (artifact.type === 'canvas') {
          state.canvas.ensureArtifact(artifactId);
        }
        if (artifact.type === 'dashboard') {
          state.dashboard.ensureDashboardArtifact(artifactId);
        }
        return {
          success: true,
          commandId: 'artifact.select',
          message: `Selected artifact "${artifactId}".`,
        };
      },
    },

    // Per-type create commands
    createArtifactCommand('notebook', 'Notebook'),
    createArtifactCommand('canvas', 'Canvas'),
    createArtifactCommand('app', 'App'),
    createDashboardCreateArtifactCommand(),
    {
      id: 'dashboard.set-vgplot',
      name: 'Set dashboard vgplot',
      description: 'Set the vgplot JSON spec for a dashboard artifact',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'update'],
      inputSchema: DashboardSetVgPlotCommandInput,
      inputDescription:
        'Provide vgplot JSON and an optional dashboard artifact ID.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      validateInput: (input, {getState}) => {
        const {artifactId, vgplot} = input as DashboardSetVgPlotCommandInput;
        parseVgPlotSpecString(vgplot);
        if (!artifactId) return;
        const artifact = getState().artifacts.getArtifact(artifactId);
        if (!artifact) {
          throw new Error(`Unknown artifact "${artifactId}".`);
        }
        if (artifact.type !== 'dashboard') {
          throw new Error(
            `Artifact "${artifactId}" is not a dashboard artifact.`,
          );
        }
      },
      execute: ({getState}, input) => {
        const {artifactId, vgplot} = input as DashboardSetVgPlotCommandInput;
        const state = getState();
        const targetArtifactId =
          artifactId ??
          state.dashboard.getCurrentDashboardArtifactId() ??
          state.dashboard.createDashboardArtifact();
        state.dashboard.setDashboardVgPlot(targetArtifactId, vgplot);
        state.artifacts.setCurrentArtifact(targetArtifactId);
        return {
          success: true,
          commandId: 'dashboard.set-vgplot',
          message: `Updated dashboard spec for "${targetArtifactId}".`,
          data: {artifactId: targetArtifactId},
        };
      },
    },
    {
      id: 'dashboard.get-vgplot',
      name: 'Get dashboard vgplot',
      description: 'Read the current vgplot JSON spec for a dashboard artifact',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'read'],
      inputSchema: DashboardGetVgPlotCommandInput,
      inputDescription: 'Optional dashboard artifact ID.',
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const resolvedInput =
          (input as DashboardGetVgPlotCommandInput | undefined) ?? {};
        const state = getState();
        const targetArtifactId =
          resolvedInput.artifactId ??
          state.dashboard.getCurrentDashboardArtifactId();
        if (!targetArtifactId) {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: 'No dashboard artifact is available.',
          };
        }
        const artifact = state.artifacts.getArtifact(targetArtifactId);
        if (!artifact || artifact.type !== 'dashboard') {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
          };
        }
        state.dashboard.ensureDashboardArtifact(targetArtifactId);
        const vgplot = state.dashboard.getDashboardVgPlot(targetArtifactId);
        return {
          success: true,
          commandId: 'dashboard.get-vgplot',
          data: {
            artifactId: targetArtifactId,
            vgplot,
          },
        };
      },
    },
  ];
}
