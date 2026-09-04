import {blockDocumentToMarkdown} from '../src/blockDocumentToMarkdown';
import type {BlockDocumentContent} from '../src/BlockDocumentSliceConfig';

function doc(content: BlockDocumentContent['content']): BlockDocumentContent {
  return {type: 'doc', content};
}

describe('blockDocumentToMarkdown', () => {
  it('serializes headings, paragraphs, and marks', () => {
    const content = doc([
      {
        type: 'heading',
        attrs: {level: 2},
        content: [{type: 'text', text: 'Section'}],
      },
      {
        type: 'paragraph',
        content: [
          {type: 'text', text: 'Hello '},
          {type: 'text', text: 'world', marks: [{type: 'bold'}]},
          {type: 'text', text: ' and '},
          {type: 'text', text: 'more', marks: [{type: 'italic'}]},
        ],
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe(
      '## Section\n\nHello **world** and *more*',
    );
  });

  it('serializes lists, tasks, code, and blockquotes', () => {
    const content = doc([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{type: 'text', text: 'Item 1'}],
              },
            ],
          },
        ],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: {checked: true},
            content: [
              {
                type: 'paragraph',
                content: [{type: 'text', text: 'Done'}],
              },
            ],
          },
        ],
      },
      {
        type: 'codeBlock',
        content: [{type: 'text', text: 'const x = 1;'}],
      },
      {
        type: 'blockquote',
        content: [
          {type: 'paragraph', content: [{type: 'text', text: 'Quote'}]},
        ],
      },
    ]);

    const markdown = blockDocumentToMarkdown(content);
    expect(markdown).toContain('- Item 1');
    expect(markdown).toContain('- [x] Done');
    expect(markdown).toContain('```\nconst x = 1;\n```');
    expect(markdown).toContain('> Quote');
  });

  it('serializes tables', () => {
    const content = doc([
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {type: 'paragraph', content: [{type: 'text', text: 'A'}]},
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {type: 'paragraph', content: [{type: 'text', text: 'B'}]},
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {type: 'paragraph', content: [{type: 'text', text: '1'}]},
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {type: 'paragraph', content: [{type: 'text', text: '2'}]},
                ],
              },
            ],
          },
        ],
      },
    ]);

    const markdown = blockDocumentToMarkdown(content);
    expect(markdown).toContain('| A   | B   |');
    expect(markdown).toContain('| 1   | 2   |');
  });

  it('renders a chart block with its caption', () => {
    const content = doc([
      {
        type: 'blockDocumentChart',
        attrs: {id: 'c1', tableName: 'sales', caption: 'Revenue by quarter'},
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe(
      '![Revenue by quarter](chart)',
    );
  });

  it('renders a chart block without a caption using a fallback label', () => {
    const content = doc([
      {type: 'blockDocumentChart', attrs: {id: 'c1', tableName: 'sales'}},
    ]);

    expect(blockDocumentToMarkdown(content)).toBe('![Chart](chart)');
  });

  it('renders a stateful block (map) with its caption', () => {
    const content = doc([
      {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: 'm1',
          blockType: 'map',
          blockInstanceId: 'm1',
          caption: 'Store locations',
        },
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe('![Store locations](map)');
  });

  it('renders a stateful block without a caption using the block type', () => {
    const content = doc([
      {
        type: 'blockDocumentStatefulBlock',
        attrs: {id: 'd1', blockType: 'dashboard', blockInstanceId: 'd1'},
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe('![dashboard](dashboard)');
  });

  it('renders an image block with its caption and asset id', () => {
    const content = doc([
      {
        type: 'blockDocumentImage',
        attrs: {id: 'i1', assetId: 'asset-1', caption: 'A chart'},
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe('![A chart](asset-1)');
  });

  it('renders a chart image block with its caption', () => {
    const content = doc([
      {
        type: 'blockDocumentChartImage',
        attrs: {id: 'ci1', assetId: 'asset-2', caption: 'Snapshot'},
      },
    ]);

    expect(blockDocumentToMarkdown(content)).toBe('![Snapshot](asset-2)');
  });

  it('prepends the document title as a heading', () => {
    const content = doc([
      {
        type: 'paragraph',
        content: [{type: 'text', text: 'Body text'}],
      },
    ]);

    expect(blockDocumentToMarkdown(content, {title: 'My Report'})).toBe(
      '# My Report\n\nBody text',
    );
  });

  it('returns only the title when the body is empty', () => {
    expect(blockDocumentToMarkdown(doc([]), {title: 'Empty'})).toBe('# Empty');
  });

  it('returns an empty string for an empty document without a title', () => {
    expect(blockDocumentToMarkdown(doc([]))).toBe('');
  });
});
