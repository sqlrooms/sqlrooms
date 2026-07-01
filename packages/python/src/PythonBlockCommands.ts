import {
  BlockDocumentStatefulBlockBlock,
  type BlockDocumentBlockType,
  type BlockDocumentsSliceState,
} from '@sqlrooms/documents';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  PythonInput,
  PythonOutputDeclaration,
  PythonRequirementSpec,
} from './types';
import type {PythonSliceState} from './PythonSlice';

export const PYTHON_BLOCK_TYPE = 'python';

export const PYTHON_BLOCK_COMMAND_SUFFIXES = [
  'add-python-block',
  'update-python-block-code',
  'run-python-block',
  'clear-python-block-result',
] as const;

export type PythonBlockCommandSuffix =
  (typeof PYTHON_BLOCK_COMMAND_SUFFIXES)[number];

type PythonBlockCommandState = BaseRoomStoreState &
  PythonSliceState &
  BlockDocumentsSliceState & {
    artifacts: {
      getArtifact: (id: string) => {type: string} | undefined;
    };
  };

export type CreatePythonBlockCommandsOptions = {
  artifactType?: string;
  artifactLabel?: string;
  commandNamespace?: string;
  commandGroup?: string;
};

function createPythonBlockInputSchemas(artifactLabel: string) {
  const artifactIdDescription = `Target ${artifactLabel.toLowerCase()} artifact ID.`;
  const PythonBlockInput = z.object({
    artifactId: z.string().describe(artifactIdDescription),
    blockId: z.string().describe('Document Python block ID.'),
  });

  return {
    AddPythonBlockInput: z.object({
      artifactId: z.string().describe(artifactIdDescription),
      blockId: z.string().optional().describe('Optional document block ID.'),
      blockInstanceId: z
        .string()
        .optional()
        .describe('Optional backing Python block ID. Defaults to blockId.'),
      title: z.string().optional().describe('Optional Python block title.'),
      code: z.string().optional().describe('Initial Python code.'),
      inputs: z.array(PythonInput).optional(),
      outputs: z.array(PythonOutputDeclaration).optional(),
      requirements: z.array(PythonRequirementSpec).optional(),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Optional top-level insertion index. Defaults to append.'),
    }),
    PythonBlockInput,
    UpdatePythonBlockCodeInput: PythonBlockInput.extend({
      code: z.string().describe('Replacement Python code.'),
      run: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to run the block after updating the code.'),
    }),
  };
}

function keywordParts(...values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.toLowerCase().split(/[-_\s]+/))
        .filter(Boolean),
    ),
  );
}

/** Creates command-backed Python block operations for block document artifacts. */
export function createPythonBlockCommands<
  TRoomState extends PythonBlockCommandState = PythonBlockCommandState,
>({
  artifactType = 'block-document',
  artifactLabel = 'Block Document',
  commandNamespace = 'block-document',
  commandGroup = artifactLabel,
}: CreatePythonBlockCommandsOptions = {}): RoomCommand<TRoomState>[] {
  const commandId = (suffix: PythonBlockCommandSuffix) =>
    `${commandNamespace}.${suffix}`;
  const {AddPythonBlockInput, PythonBlockInput, UpdatePythonBlockCodeInput} =
    createPythonBlockInputSchemas(artifactLabel);
  const artifactKeywords = keywordParts(commandNamespace, artifactLabel);

  const commands = {
    'add-python-block': {
      id: commandId('add-python-block'),
      name: 'Add Python block',
      description:
        'Create a visible Python block with persisted code and declarations.',
      group: commandGroup,
      keywords: ['python', 'block', ...artifactKeywords],
      inputSchema: AddPythonBlockInput,
      inputDescription: `${artifactLabel} artifact ID plus optional title, code, inputs, outputs, requirements, and insertion index.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const parsed = AddPythonBlockInput.parse(input);
        const resolved = resolveBlockDocumentArtifact(
          state,
          parsed.artifactId,
          commandId('add-python-block'),
          artifactType,
          artifactLabel,
        );
        if (!resolved.success) return resolved;

        const blockId = parsed.blockId ?? createBlockId();
        const blockInstanceId = parsed.blockInstanceId ?? blockId;
        const title = parsed.title ?? 'Python';
        const pythonBlock = state.python.ensureBlock(blockInstanceId, {
          title,
          code: parsed.code,
          inputs: parsed.inputs,
          outputs: parsed.outputs,
          requirements: parsed.requirements,
        });
        const block = BlockDocumentStatefulBlockBlock.parse({
          id: blockId,
          type: 'statefulBlock',
          blockType: PYTHON_BLOCK_TYPE,
          blockInstanceId,
          ownership: 'owned',
          title,
        });
        insertOrAppendBlocks(state, parsed.artifactId, [block], parsed.index);

        return {
          success: true,
          commandId: commandId('add-python-block'),
          message: `Added Python block "${blockId}".`,
          data: {
            artifactId: parsed.artifactId,
            block,
            pythonBlock,
          },
        };
      },
    },
    'update-python-block-code': {
      id: commandId('update-python-block-code'),
      name: 'Update Python block code',
      description: 'Update the code stored for a visible Python block.',
      group: commandGroup,
      keywords: ['python', 'block', 'code', 'update', ...artifactKeywords],
      inputSchema: UpdatePythonBlockCodeInput,
      inputDescription: `${artifactLabel} artifact ID, Python block ID, replacement code, and optional run flag.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'high'},
      execute: async ({getState}, input) => {
        const state = getState();
        const parsed = UpdatePythonBlockCodeInput.parse(input);
        const block = resolvePythonBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('update-python-block-code'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        state.python.updateBlockCode(block.block.blockInstanceId, parsed.code);
        const result = parsed.run
          ? await state.python.runBlock(block.block.blockInstanceId, {
              artifactId: parsed.artifactId,
            })
          : undefined;
        return {
          success: result ? result.status === 'success' : true,
          commandId: commandId('update-python-block-code'),
          message: result
            ? result.status === 'success'
              ? `Updated and ran Python block "${parsed.blockId}".`
              : `Updated Python block "${parsed.blockId}", then run finished with ${result.status}.`
            : `Updated Python block "${parsed.blockId}".`,
          data: {
            artifactId: parsed.artifactId,
            block: block.block,
            pythonBlock: state.python.getBlock(block.block.blockInstanceId),
            ...(result ? {executionId: result.executionId, result} : undefined),
          },
          ...(result && result.status !== 'success'
            ? {error: result.error?.message ?? 'Python execution failed.'}
            : {}),
        };
      },
    },
    'run-python-block': {
      id: commandId('run-python-block'),
      name: 'Run Python block',
      description:
        'Run a visible Python block through the configured Python runtime adapter.',
      group: commandGroup,
      keywords: ['python', 'block', 'run', 'execute', ...artifactKeywords],
      inputSchema: PythonBlockInput,
      inputDescription: `${artifactLabel} artifact ID and Python block ID.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'high'},
      execute: async ({getState}, input) => {
        const state = getState();
        const parsed = PythonBlockInput.parse(input);
        const block = resolvePythonBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('run-python-block'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        const result = await state.python.runBlock(
          block.block.blockInstanceId,
          {artifactId: parsed.artifactId},
        );
        return {
          success: result.status === 'success',
          commandId: commandId('run-python-block'),
          message:
            result.status === 'success'
              ? `Ran Python block "${parsed.blockId}".`
              : `Python block "${parsed.blockId}" finished with ${result.status}.`,
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
    'clear-python-block-result': {
      id: commandId('clear-python-block-result'),
      name: 'Clear Python block result',
      description: 'Clear the persisted result summary for a Python block.',
      group: commandGroup,
      keywords: ['python', 'block', 'clear', 'result', ...artifactKeywords],
      inputSchema: PythonBlockInput,
      inputDescription: `${artifactLabel} artifact ID and Python block ID.`,
      metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const state = getState();
        const parsed = PythonBlockInput.parse(input);
        const block = resolvePythonBlock(
          state,
          parsed.artifactId,
          parsed.blockId,
          commandId('clear-python-block-result'),
          artifactType,
          artifactLabel,
        );
        if (!block.success) return block;
        state.python.clearBlockResult(block.block.blockInstanceId);
        return {
          success: true,
          commandId: commandId('clear-python-block-result'),
          message: `Cleared Python block "${parsed.blockId}" result.`,
          data: {
            artifactId: parsed.artifactId,
            block: block.block,
          },
        };
      },
    },
  } satisfies Record<PythonBlockCommandSuffix, RoomCommand<TRoomState>>;

  return PYTHON_BLOCK_COMMAND_SUFFIXES.map((suffix) => commands[suffix]);
}

function resolveBlockDocumentArtifact(
  state: PythonBlockCommandState,
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

function resolvePythonBlock(
  state: PythonBlockCommandState,
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
  if (block.type !== 'statefulBlock' || block.blockType !== PYTHON_BLOCK_TYPE) {
    return {
      success: false as const,
      commandId,
      error: `Block "${blockId}" is not a Python block.`,
    };
  }
  return {success: true as const, block};
}

function insertOrAppendBlocks(
  state: PythonBlockCommandState,
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
  return `python-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
