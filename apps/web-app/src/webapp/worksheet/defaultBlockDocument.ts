import type {JsonObject} from '#/lib/json';

export type BlockDocumentContent = {
  type: 'doc';
  content: JsonObject[];
};

export function createDefaultWorksheetContent(): BlockDocumentContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: {level: 1},
        content: [{type: 'text', text: 'Untitled analysis'}],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Add files locally, then save the workspace to persist worksheets and Parquet-backed files.',
          },
        ],
      },
    ],
  };
}
