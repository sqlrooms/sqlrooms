import {
  BlockDocumentStatefulBlockBlock,
  type BlockDocumentBlockType,
  type BlockDocumentsSliceState,
} from '@sqlrooms/documents';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  PythonCellInput,
  PythonCellOutputDeclaration,
  PythonRequirementSpec,
} from './types';
import type {PythonCellSliceState} from './PythonCellSlice';

export const PYTHON_CELL_BLOCK_TYPE = 'python-cell';

export const PYTHON_CELL_COMMAND_SUFFIXES = [
  'add-python-cell-block',
  'update-python-cell-code',
  'run-python-cell-block',
  'clear-python-cell-result',
] as const;

export type PythonCellCommandSuffix =
  (typeof PYTHON_CELL_COMMAND_SUFFIXES)[number];

type PythonCellCommandState = BaseRoomStoreState &
  PythonCellSliceState &
  BlockDocumentsSliceState & {
    artifacts: {
      getArtifact: (id: string) => {type: string} | undefined;
    };
  };

export type CreatePythonCellCommandsOptions = {
  artifactType?: string;
  artifactLabel?: string;
  commandNamespace?: string;
  commandGroup?: string;
};

const AddPythonCellBlockInput = z.object({
  artifactId: z.string().describe('Target worksheet or block document ID.'),
  blockId: z.string().optional().describe('Optional document block ID.'),
  blockInstanceId: z
    .string()
    .optional()
    .describe('Optional backing Python cell ID. Defaults to blockId.'),
  title: z.string().optional().describe('Optional Python cell title.'),
  code: z.string().optional().describe('Initial Python code.'),
  inputs: z.array(PythonCellInput).optional(),
  outputs: z.array(PythonCellOutputDeclaration).optional(),
  requirements: z.array(PythonRequirementSpec).optional(),
  index: z
    .number()
    .int()
    .optional()
    .describe('Optional top-level insertion index. Defaults to append.'),
});

const PythonCellBlockInput = z.object({
  artifactId: z.string().describe('Target worksheet or block document ID.'),
  blockId: z.string().describe('Document Python cell block ID.'),
});

const UpdatePythonCellCodeInput = PythonCellBlockInput.extend({
  code: z.string().describe('Replacement Python code.'),
});

/** Creates command-backed Python cell operations for worksheet/block documents. */
export function createPythonCellCommands<
  TRoomState extends PythonCellCommandState = PythonCellCommandState,
>({
  artifactType = 'worksheet',
  artifactLabel = 'Worksheet',
  commandNamespace = 'worksheet',
  commandGroup = artifactLabel,
}: CreatePythonCellCommandsOptions = {}): RoomCommand<TRoomState>[] {
  const commandId = (suffix: PythonCellCommandSuffix) =>
    `${commandNamespace}.${suffix}`;

  const commands = {
    'add-python-cell-block': {
      id: commandId('add-python-cell-block'),
      name: 'Add Python cell block',
      description:
        'Create a visible Python cell block with persisted code and declarations.',
      group: commandGroup,
      keywords: ['python', 'cell', 'block', 'worksheet'],
      inputSchema: AddPythonCellBlockInput,
      inputDescription:
        'Worksheet artifact ID plus optional title, code, inputs, outputs, requirements, and insertion index.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const parsed = AddPythonCellBlockInput.parse(input);
        const resolved = resolveBlockDocumentArtifact(
          state,
          parsed.artifactId,
          commandId('add-python-cell-block'),
          artifactType,
          artifactLabel,
        );
        if (!resolved.success) return resolved;

        const blockId = parsed.blockId ?? createBlockId();
        const blockInstanceId = parsed.blockInstanceId ?? blockId;
        const title = parsed.title ?? 'Python Cell';
        const cell = state.pythonCells.ensureCell(blockInstanceId, {
          title,
          code: parsed.code,
          inputs: parsed.inputs,
          outputs: parsed.outputs,
          requirements: parsed.requirements,
        });
        const block = BlockDocumentStatefulBlockBlock.parse({
          id: blockId,
          type: 'statefulBlock',
          blockType: PYTHON_CELL_BLOCK_TYPE,
          blockInstanceId,
          ownership: 'owned',
          title,
        });
        insertOrAppendBlocks(state, parsed.artifactId, [block], parsed.index);

        return {
          success: true,
          commandId: commandId('add-python-cell-block'),
          message: `Added Python cell block "${blockId}".`,
          data: {
            artifactId: parsed.artifactId,
            block,
            cell,
          },
        };
      },
    },
    'update-python-cell-code': {
      id: commandId('update-python-cell-code'),
      name: 'Update Python cell code',
      description: 'Update the code stored for a visible Python cell block.',
      group: commandGroup,
      keywords: ['python', 'cell', 'code', 'update'],
      inputSchema: UpdatePythonCellCodeInput,
      inputDescription: 'Worksheet artifact ID, Python block ID, and code.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const parsed = UpdatePythonCellCodeInput.parse(input);
        const block = resolvePythonCellBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('update-python-cell-code'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        state.pythonCells.updateCellCode(
          block.block.blockInstanceId,
          parsed.code,
        );
        return {
          success: true,
          commandId: commandId('update-python-cell-code'),
          message: `Updated Python cell block "${parsed.blockId}".`,
          data: {
            artifactId: parsed.artifactId,
            block: block.block,
            cell: state.pythonCells.getCell(block.block.blockInstanceId),
          },
        };
      },
    },
    'run-python-cell-block': {
      id: commandId('run-python-cell-block'),
      name: 'Run Python cell block',
      description:
        'Run a visible Python cell block through the configured Python runtime adapter.',
      group: commandGroup,
      keywords: ['python', 'cell', 'run', 'execute'],
      inputSchema: PythonCellBlockInput,
      inputDescription: 'Worksheet artifact ID and Python block ID.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'high'},
      execute: async ({getState}, input) => {
        const state = getState();
        const parsed = PythonCellBlockInput.parse(input);
        const block = resolvePythonCellBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('run-python-cell-block'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        const result = await state.pythonCells.runCell(
          block.block.blockInstanceId,
          {artifactId: parsed.artifactId},
        );
        return {
          success: result.status === 'success',
          commandId: commandId('run-python-cell-block'),
          message:
            result.status === 'success'
              ? `Ran Python cell block "${parsed.blockId}".`
              : `Python cell block "${parsed.blockId}" finished with ${result.status}.`,
          data: {
            artifactId: parsed.artifactId,
            block: block.block,
            executionId: result.executionId,
            result,
          },
          ...(result.status === 'success'
            ? {}
            : {error: result.error?.message ?? 'Python execution failed.'}),
        };
      },
    },
    'clear-python-cell-result': {
      id: commandId('clear-python-cell-result'),
      name: 'Clear Python cell result',
      description:
        'Clear the persisted result summary for a Python cell block.',
      group: commandGroup,
      keywords: ['python', 'cell', 'clear', 'result'],
      inputSchema: PythonCellBlockInput,
      inputDescription: 'Worksheet artifact ID and Python block ID.',
      metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const state = getState();
        const parsed = PythonCellBlockInput.parse(input);
        const block = resolvePythonCellBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('clear-python-cell-result'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        state.pythonCells.clearCellResult(block.block.blockInstanceId);
        return {
          success: true,
          commandId: commandId('clear-python-cell-result'),
          message: `Cleared Python cell block "${parsed.blockId}" result.`,
          data: {
            artifactId: parsed.artifactId,
            block: block.block,
          },
        };
      },
    },
  } satisfies Record<PythonCellCommandSuffix, RoomCommand<TRoomState>>;

  return PYTHON_CELL_COMMAND_SUFFIXES.map((suffix) => commands[suffix]);
}

function resolveBlockDocumentArtifact(
  state: PythonCellCommandState,
  artifactId: string,
  commandId: string,
  artifactType: string,
  artifactLabel: string,
) {
  const artifact = state.artifacts.getArtifact(artifactId);
  if (!artifact) {
    return {
      success: false as const,
      commandId,
      error: `Unknown artifact "${artifactId}".`,
    };
  }
  if (artifact.type !== artifactType) {
    return {
      success: false as const,
      commandId,
      error: `Artifact "${artifactId}" is not a ${artifactLabel} artifact.`,
    };
  }
  return {success: true as const, artifact};
}

function resolvePythonCellBlock(
  state: PythonCellCommandState,
  artifactId: string,
  blockId: string,
  commandId: string,
  artifactType: string,
  artifactLabel: string,
) {
  const resolved = resolveBlockDocumentArtifact(
    state,
    artifactId,
    commandId,
    artifactType,
    artifactLabel,
  );
  if (!resolved.success) return resolved;

  const block = state.blockDocuments
    .getBlocks(artifactId)
    .find((candidate) => candidate.id === blockId);
  if (!block) {
    return {
      success: false as const,
      commandId,
      error: `Unknown block "${blockId}".`,
    };
  }
  if (
    block.type !== 'statefulBlock' ||
    block.blockType !== PYTHON_CELL_BLOCK_TYPE
  ) {
    return {
      success: false as const,
      commandId,
      error: `Block "${blockId}" is not a Python cell block.`,
    };
  }
  return {success: true as const, block};
}

function insertOrAppendBlocks(
  state: PythonCellCommandState,
  artifactId: string,
  blocks: BlockDocumentBlockType[],
  index: number | undefined,
) {
  if (typeof index === 'number') {
    state.blockDocuments.insertBlocks(artifactId, index, blocks);
  } else {
    state.blockDocuments.appendBlocks(artifactId, blocks);
  }
}

function createBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `python-cell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
