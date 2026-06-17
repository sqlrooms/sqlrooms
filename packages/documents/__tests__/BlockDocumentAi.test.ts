import {
  BLOCK_DOCUMENT_AGENT_TOOL_NAME,
  createBlockDocumentAiInstructions,
  createBlockDocumentCommandIds,
  createBlockDocumentAuthoringInstructions,
} from '../src';

describe('block document AI helpers', () => {
  it('describes the command surface used by block document authoring agents', () => {
    expect(BLOCK_DOCUMENT_AGENT_TOOL_NAME).toBe('block_document_agent');
    expect(createBlockDocumentCommandIds()).toContain('block-document.create');
    expect(createBlockDocumentCommandIds()).toContain(
      'block-document.create-chart-block',
    );
    expect(createBlockDocumentCommandIds()).toContain(
      'block-document.create-stateful-block',
    );
    expect(createBlockDocumentCommandIds()).not.toContain(
      'block-document.embed-dashboard',
    );
  });

  it('builds authoring instructions with configurable tool names', () => {
    const instructions = createBlockDocumentAuthoringInstructions({
      commandToolName: 'run_command',
      blockDocumentAgentToolName: 'block_document_writer',
    });

    expect(instructions).toContain('run_command');
    expect(instructions).toContain('block_document_writer');
    expect(instructions).toContain('block-document.create-chart-block');
    expect(instructions).toContain('block-document.create-stateful-block');
    expect(instructions).toContain('selectionGroupId');
  });

  it('can generate instructions for a host-provided command namespace', () => {
    const instructions = createBlockDocumentAiInstructions({
      artifactLabel: 'Report',
      commandNamespace: 'report',
    });

    expect(instructions).toContain('Report artifacts');
    expect(instructions).toContain('report.create');
  });
});
