import type {StoreApi} from 'zustand';
import {createCliAiInstructions} from '../createCliAiInstructions';
import {
  DEFAULT_CLI_CAPABILITY_PROFILE,
  WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
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
    WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
  ])('routes new Worksheets through the nested agent for $name', (profile) => {
    const instructions = createCliAiInstructions(store, profile);

    expect(instructions).toContain(
      'execute block-document.create exactly once',
    );
    expect(instructions).toContain(
      'returned data.artifactId as blockDocumentId',
    );
    expect(instructions).toContain(
      'do not create its requested chart or map blocks through generic block-document commands',
    );
    expect(instructions).toContain(
      'call block_document_agent with that ID directly and do not create another Worksheet',
    );
  });
});
