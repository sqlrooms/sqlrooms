import {
  BLOCKS_DOCUMENT_AGENT_TOOL_NAME,
  createBlocksDocumentAiInstructions,
  createBlocksDocumentCommandIds,
  createBlocksDocumentAuthoringInstructions,
} from '../src';

describe('blocks document AI helpers', () => {
  it('describes the command surface used by blocks document authoring agents', () => {
    expect(BLOCKS_DOCUMENT_AGENT_TOOL_NAME).toBe('blocks_document_agent');
    expect(createBlocksDocumentCommandIds()).toContain(
      'blocks-document.create',
    );
    expect(createBlocksDocumentCommandIds()).toContain(
      'blocks-document.create-chart-block',
    );
    expect(createBlocksDocumentCommandIds()).toContain(
      'blocks-document.embed-dashboard',
    );
  });

  it('builds authoring instructions with configurable tool names', () => {
    const instructions = createBlocksDocumentAuthoringInstructions({
      commandToolName: 'run_command',
      blocksDocumentAgentToolName: 'blocks_document_writer',
    });

    expect(instructions).toContain('run_command');
    expect(instructions).toContain('blocks_document_writer');
    expect(instructions).toContain('blocks-document.create-chart-block');
    expect(instructions).toContain('selectionGroupId');
  });

  it('can generate instructions for a host-provided command namespace', () => {
    const instructions = createBlocksDocumentAiInstructions({
      artifactLabel: 'Report',
      commandNamespace: 'report',
    });

    expect(instructions).toContain('Report artifacts');
    expect(instructions).toContain('report.create');
  });
});
