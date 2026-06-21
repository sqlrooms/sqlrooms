import {
  BLOCK_DOCUMENT_AGENT_TOOL_NAME,
  createBlockDocumentCommandIds,
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
});
