import {
  createBlockDocumentCommands,
  createMarkdownCommands,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import {createMosaicDashboardCommands} from '@sqlrooms/mosaic';
import {createPythonBlockCommands} from '@sqlrooms/python/block';
import {
  registerCommandsForOwner,
  unregisterCommandsForOwner,
} from '@sqlrooms/room-shell';
import type {StoreApi} from 'zustand';
import {
  CLI_BLOCK_DOCUMENT_COMMAND_OWNER,
  createCliBlockDocumentCommands,
} from './createCliBlockDocumentCommands';
import {
  createDashboardCommands,
  DASHBOARD_COMMAND_OWNER,
} from './createDashboardCommands';
import {
  createHtmlAppRevisionCommands,
  HTML_APP_REVISION_COMMAND_OWNER,
} from './createHtmlAppRevisionCommands';
import type {CliCapabilityProfile} from './profiles';
import {createStatefulBlockCommandTypes} from './statefulBlockArtifactConfigs';
import type {RoomState} from './store-types';

export const MARKDOWN_COMMAND_OWNER = '@sqlrooms/documents/markdown';
export const MOSAIC_DASHBOARD_COMMAND_OWNER = '@sqlrooms/mosaic/dashboard';
export const BLOCK_DOCUMENT_COMMAND_OWNER =
  '@sqlrooms/documents/block-document';
export const BLOCK_DOCUMENT_PYTHON_COMMAND_OWNER =
  '@sqlrooms/python/block-document';

const BLOCK_DOCUMENT_OPTIONS = {
  artifactType: 'document',
  artifactLabel: 'Document',
  commandNamespace: 'block-document',
  commandGroup: 'Document',
  defaultTitle: 'Document',
} as const;

const DOCUMENT_CHARTS_MAPS_ALLOWED_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'list',
  'todo',
  'chart',
  'statefulBlock',
] as const satisfies readonly BlockDocumentBlock['type'][];

/** Registers the command groups enabled by one production CLI profile. */
export function registerCliCapabilityProfileCommands(
  store: StoreApi<RoomState>,
  profile: CliCapabilityProfile,
  artifactTypes: RoomState['artifacts']['artifactTypes'],
): void {
  registerCommandsForOwner(
    store,
    DASHBOARD_COMMAND_OWNER,
    createDashboardCommands({artifactTypes}),
  );
  if (profile.commands.includes('mosaic-dashboard')) {
    registerCommandsForOwner(
      store,
      MOSAIC_DASHBOARD_COMMAND_OWNER,
      createMosaicDashboardCommands<RoomState>(),
    );
  }
  if (profile.commands.includes('markdown')) {
    registerCommandsForOwner(
      store,
      MARKDOWN_COMMAND_OWNER,
      createMarkdownCommands<RoomState>(),
    );
  }
  if (profile.commands.includes('block-document')) {
    registerCommandsForOwner(
      store,
      BLOCK_DOCUMENT_COMMAND_OWNER,
      createBlockDocumentCommands<RoomState>({
        ...BLOCK_DOCUMENT_OPTIONS,
        statefulBlockTypes: createStatefulBlockCommandTypes({profile}),
        allowedBlockTypes:
          profile.name === 'document-charts-maps'
            ? DOCUMENT_CHARTS_MAPS_ALLOWED_BLOCK_TYPES
            : undefined,
      }),
    );
  }
  if (profile.commands.includes('cli-block-document')) {
    registerCommandsForOwner(
      store,
      CLI_BLOCK_DOCUMENT_COMMAND_OWNER,
      createCliBlockDocumentCommands({
        statefulBlockTypes: profile.blocks.stateful,
      }),
    );
  }
  if (profile.commands.includes('block-document-python')) {
    registerCommandsForOwner(
      store,
      BLOCK_DOCUMENT_PYTHON_COMMAND_OWNER,
      createPythonBlockCommands<RoomState>({
        artifactType: BLOCK_DOCUMENT_OPTIONS.artifactType,
        artifactLabel: BLOCK_DOCUMENT_OPTIONS.artifactLabel,
        commandNamespace: BLOCK_DOCUMENT_OPTIONS.commandNamespace,
        commandGroup: BLOCK_DOCUMENT_OPTIONS.commandGroup,
      }),
    );
  }
  if (profile.commands.includes('html-app-revision')) {
    registerCommandsForOwner(
      store,
      HTML_APP_REVISION_COMMAND_OWNER,
      createHtmlAppRevisionCommands(),
    );
  }
}

/** Removes all command groups potentially registered by a CLI profile. */
export function unregisterCliCapabilityProfileCommands(
  store: StoreApi<RoomState>,
): void {
  unregisterCommandsForOwner(store, DASHBOARD_COMMAND_OWNER);
  unregisterCommandsForOwner(store, MOSAIC_DASHBOARD_COMMAND_OWNER);
  unregisterCommandsForOwner(store, MARKDOWN_COMMAND_OWNER);
  unregisterCommandsForOwner(store, BLOCK_DOCUMENT_COMMAND_OWNER);
  unregisterCommandsForOwner(store, CLI_BLOCK_DOCUMENT_COMMAND_OWNER);
  unregisterCommandsForOwner(store, BLOCK_DOCUMENT_PYTHON_COMMAND_OWNER);
  unregisterCommandsForOwner(store, HTML_APP_REVISION_COMMAND_OWNER);
}
