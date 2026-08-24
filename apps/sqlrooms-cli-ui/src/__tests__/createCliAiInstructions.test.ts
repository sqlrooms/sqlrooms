import type {StoreApi} from 'zustand';
import {createCliAiInstructions} from '../createCliAiInstructions';
import {
  DEFAULT_CLI_CAPABILITY_PROFILE,
  DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
} from '../profiles';
import type {RoomState} from '../store-types';

const store = {
  getState: () => ({
    db: {
      tables: [],
      currentDatabase: 'memory',
    },
  }),
} as unknown as StoreApi<RoomState>;

describe('createCliAiInstructions', () => {
  it.each([
    DEFAULT_CLI_CAPABILITY_PROFILE,
    DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
  ])('routes new Documents through the nested agent for $name', (profile) => {
    const instructions = createCliAiInstructions(store, profile);

    expect(instructions).toContain(
      'execute block-document.create exactly once',
    );
    expect(instructions).toContain(
      'returned result.data.artifactId as the new blockDocumentId',
    );
    expect(instructions).toContain(
      'takes precedence over any Document artifact ID in run context',
    );
    expect(instructions).toContain(
      'do not create its requested chart or map blocks through generic block-document commands',
    );
    expect(instructions).toContain(
      'For Document block types that the tool does not expose, such as Python, pivot, Markdown, or SQL-query blocks, use the corresponding registered block-document commands',
    );
    expect(instructions).toContain(
      'asks to edit or add a block type exposed by block_document_agent to an existing Document',
    );
  });

  it.each([
    DEFAULT_CLI_CAPABILITY_PROFILE,
    DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
  ])(
    'routes unsupported existing Document blocks through commands for $name',
    (profile) => {
      const instructions = createCliAiInstructions(store, profile);

      expect(instructions).toContain(
        'For a block type that block_document_agent does not expose in an existing Document, use the corresponding registered block-document command with the existing artifact ID.',
      );
    },
  );
});
