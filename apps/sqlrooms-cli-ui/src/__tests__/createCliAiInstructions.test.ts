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
      'returned result.data.artifactId as the new blockDocumentId',
    );
    expect(instructions).toContain(
      'takes precedence over any Worksheet artifact ID in run context',
    );
    expect(instructions).toContain(
      'do not create its requested chart or map blocks through generic block-document commands',
    );
    expect(instructions).toContain(
      'For Worksheet block types that the tool does not expose, such as Python, pivot, document, or SQL-query blocks, use the corresponding registered block-document commands',
    );
    expect(instructions).toContain(
      'asks to edit or add content to an existing Worksheet',
    );
  });
});
