import {formatBlockDocumentContext} from '../src/formatBlockDocumentContext';
import type {
  BlockDocumentContent,
  BlockDocumentNode,
} from '../src/BlockDocumentSliceConfig';

function paragraph(id: string, text: string): BlockDocumentNode {
  return {type: 'paragraph', attrs: {id}, content: [{type: 'text', text}]};
}
function doc(...content: BlockDocumentNode[]): BlockDocumentContent {
  return {type: 'doc', content};
}

describe('formatBlockDocumentContext', () => {
  it('preserves rich text, order, and exact resource references without embedding config or pixels', () => {
    const snapshot = formatBlockDocumentContext(
      doc(
        {
          type: 'heading',
          attrs: {id: 'heading-1', level: 2},
          content: [{type: 'text', text: 'Regional performance'}],
        },
        {
          type: 'bulletList',
          attrs: {id: 'list-1'},
          content: [
            {
              type: 'listItem',
              content: [paragraph('nested', 'Northeast grew fastest')],
            },
          ],
        },
        {
          type: 'blockDocumentStatefulBlock',
          attrs: {
            id: 'map-block',
            blockType: 'map',
            blockInstanceId: 'map-resource',
            ownership: 'shared',
            tableName: 'stores',
            caption: 'Store locations',
            intent: 'Compare regions',
            config: {secret: 'not-for-context'},
          },
        },
        {
          type: 'blockDocumentImage',
          attrs: {id: 'image-1', assetId: 'asset-1', caption: 'Overview'},
        },
      ),
      {
        augmentBlockSummary: ({block}) =>
          block.id === 'map-block'
            ? {runtimeIssues: ['Missing column']}
            : undefined,
      },
    );

    expect(snapshot).toContain('"truncated":false');
    expect(snapshot).toContain('## Regional performance');
    expect(snapshot).toContain('- Northeast grew fastest');
    expect(snapshot).toContain('"blockId":"map-block","index":2');
    expect(snapshot).toContain('"blockInstanceId":"map-resource"');
    expect(snapshot).toContain('"ownership":"shared"');
    expect(snapshot).toContain('"tableName":"stores"');
    expect(snapshot).toContain('"intent":"Compare regions"');
    expect(snapshot).toContain('Missing column');
    expect(snapshot).toContain('![Store locations](map)');
    expect(snapshot).toContain('![Overview](asset-1)');
    expect(snapshot).not.toContain('not-for-context');
    expect(snapshot).not.toContain('data:image');
    expect(snapshot.indexOf('heading-1')).toBeLessThan(
      snapshot.indexOf('map-block'),
    );
  });

  it('keeps standard rich nodes even when they are not supported by the block summary adapter', () => {
    const snapshot = formatBlockDocumentContext(
      doc(
        {
          type: 'codeBlock',
          attrs: {id: 'sql', language: 'sql'},
          content: [{type: 'text', text: 'SELECT 1;'}],
        },
        paragraph('p', 'A paragraph'),
      ),
    );
    expect(snapshot).toContain('"blockId":"sql"');
    expect(snapshot).toContain('```sql\nSELECT 1;\n```');
    expect(snapshot).toContain('"blockCount":2');
  });

  it('prioritizes a late target and neighbors while retaining original document indices', () => {
    const nodes = Array.from({length: 100}, (_, index) =>
      paragraph(`p${index}`, `Text ${index}`),
    );
    const snapshot = formatBlockDocumentContext(doc(...nodes), {
      maxChars: 600,
      targetBlockId: 'p90',
    });
    expect(snapshot.length).toBeLessThanOrEqual(600);
    expect(snapshot).toContain('"blockId":"p90","index":90');
    expect(snapshot).toContain('"blockId":"p89","index":89');
    expect(snapshot.indexOf('"p89"')).toBeLessThan(snapshot.indexOf('"p90"'));
    expect(snapshot).toContain('"truncated":true');
    expect(snapshot).not.toContain('"omittedBlockCount":0');
  });

  it('marks excerpts and bounds the entire output even with oversized host metadata', () => {
    const content = doc(paragraph('p', 'x'.repeat(20_000)));
    const snapshot = formatBlockDocumentContext(content, {maxChars: 512});
    expect(snapshot.length).toBeLessThanOrEqual(512);
    expect(snapshot).toContain('"blockId":"p"');
    expect(snapshot).toContain('Block content truncated');
    expect(snapshot).toContain('"truncated":true');
    const oversized = formatBlockDocumentContext(content, {
      maxChars: 512,
      targetBlockId: 'p',
      augmentBlockSummary: () => ({issues: 'x'.repeat(10_000)}),
    });
    expect(oversized.length).toBeLessThanOrEqual(512);
    expect(oversized).toContain('"omittedBlockCount":0');
    expect(oversized).toContain('"blockId":"p"');
    expect(oversized).toContain('"metadataTruncated":true');
  });

  it('marks shortened intent metadata and protects stable IDs from augmentation', () => {
    const node = paragraph('original', 'Short text');
    node.attrs = {...node.attrs, intent: 'purpose '.repeat(100)};
    const snapshot = formatBlockDocumentContext(doc(node), {
      augmentBlockSummary: () => ({blockId: 'wrong', index: 42}),
    });
    expect(snapshot).toContain('"metadataTruncated":true');
    expect(snapshot).toContain('"truncated":true');
    expect(snapshot).toContain('"blockId":"original","index":0');
    expect(snapshot).not.toContain('wrong');
  });

  it('clips large text before the summary adapter and exporter see it', () => {
    const node: BlockDocumentNode = {
      type: 'heading',
      attrs: {id: 'logs', level: 2},
      content: [{type: 'text', text: 'x'.repeat(1_000_000)}],
    };
    let summaryText = '';
    const snapshot = formatBlockDocumentContext(doc(node), {
      augmentBlockSummary: ({summary}) => {
        summaryText = summary.title ?? '';
        return undefined;
      },
    });
    expect(summaryText).toHaveLength(2_000);
    expect(snapshot).toContain('"blockId":"logs"');
    expect(snapshot).toContain('Block content truncated');
    expect(snapshot.length).toBeLessThan(2_200);
    expect(node.content?.[0]?.text).toHaveLength(1_000_000);
  });

  it('does not traverse backing chart configuration', () => {
    const config = Object.defineProperty({}, 'data', {
      enumerable: true,
      get() {
        throw new Error('Visited backing chart configuration');
      },
    });
    const snapshot = formatBlockDocumentContext(
      doc({
        type: 'blockDocumentChart',
        attrs: {id: 'chart', tableName: 'sales', config},
      }),
      {
        augmentBlockSummary: ({block}) => {
          expect(block.type === 'chart' && block.config).toBe(config);
          return undefined;
        },
      },
    );
    expect(snapshot).toContain('"blockId":"chart"');
    expect(snapshot).toContain('"tableName":"sales"');
    expect(snapshot).toContain('"truncated":false');
  });

  it('stops visiting wide subtrees even when their nodes contain no text', () => {
    const content = Array.from({length: 100_000}, () => ({
      type: 'listItem',
      content: [{type: 'paragraph'}],
    }));
    // Fails if either the summary adapter or serializer visits the discarded tail.
    Object.defineProperty(content, 300, {
      get() {
        throw new Error('Visited discarded subtree');
      },
    });
    const snapshot = formatBlockDocumentContext(
      doc({
        type: 'bulletList',
        attrs: {id: 'wide-list'},
        content,
      }),
    );
    expect(snapshot).toContain('"blockId":"wide-list"');
    expect(snapshot).toContain('"truncated":true');
    expect(snapshot).toContain('Block content truncated');
  });

  it('bounds nesting depth before recursive serialization', () => {
    let node: BlockDocumentNode = paragraph('leaf', 'Deep text');
    for (let index = 0; index < 5_000; index++) {
      node = {type: 'blockquote', content: [node]};
    }
    node.attrs = {id: 'deep-quote'};
    const snapshot = formatBlockDocumentContext(doc(node));
    expect(snapshot).toContain('"blockId":"deep-quote"');
    expect(snapshot).toContain('"truncated":true');
    expect(snapshot).not.toContain('Deep text');
  });

  it('preserves ordinary inline formatting and links in the bounded copy', () => {
    const snapshot = formatBlockDocumentContext(
      doc({
        type: 'paragraph',
        attrs: {id: 'rich'},
        content: [
          {type: 'text', text: 'Important', marks: [{type: 'bold'}]},
          {
            type: 'text',
            text: ' source',
            marks: [{type: 'link', attrs: {href: 'https://example.com'}}],
          },
        ],
      }),
    );
    expect(snapshot).toContain('**Important**');
    expect(snapshot).toContain('](https://example.com)');
    expect(snapshot).toContain('"truncated":false');
  });

  it('reports empty documents and does not invent IDs for unnormalized text', () => {
    expect(formatBlockDocumentContext(doc())).toContain(
      '"blockCount":0,"omittedBlockCount":0,"truncated":false',
    );
    expect(
      formatBlockDocumentContext(
        doc({
          type: 'paragraph',
          content: [{type: 'text', text: 'Unnormalized'}],
        }),
      ),
    ).not.toContain('blockId');
  });

  it.each([0, 255, 512.5, NaN, Infinity])(
    'rejects invalid budgets (%s)',
    (maxChars) => {
      expect(() => formatBlockDocumentContext(doc(), {maxChars})).toThrow(
        RangeError,
      );
    },
  );
});
