/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import type {JSONContent} from '@tiptap/core';

jest.unstable_mockModule(
  '../src/BlockDocumentEditor/node-views/BlockDocumentChartNodeView',
  () => ({BlockDocumentChartNodeView: () => null}),
);

const {generateHTML, generateJSON, Node} = await import('@tiptap/core');
const {BlockDocumentChartNode} =
  await import('../src/BlockDocumentEditor/extensions/BlockDocumentChartNode');

const Document = Node.create({name: 'doc', topNode: true, content: 'block+'});
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'text*',
  parseHTML: () => [{tag: 'p'}],
  renderHTML: () => ['p', 0],
});
const Text = Node.create({name: 'text', group: 'inline'});
const extensions = [Document, Paragraph, Text, BlockDocumentChartNode];

function roundTrip(content: JSONContent): JSONContent {
  return generateJSON(generateHTML(content, extensions), extensions);
}

describe('BlockDocumentChartNode HTML round trip (copy/paste)', () => {
  it('keeps an object config intact', () => {
    const config = {
      vegaLiteSpec: {
        mark: 'bar',
        encoding: {x: {field: 'name', type: 'nominal'}},
      },
      sqlQuery: 'SELECT name, "count" FROM "t" WHERE name <> \'x\'',
    };
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockDocumentChart',
          attrs: {
            id: 'chart-1',
            tableName: 'main.t',
            caption: 'A caption',
            config,
          },
        },
      ],
    };

    const chart = roundTrip(doc).content?.[0];

    expect(chart?.type).toBe('blockDocumentChart');
    expect(chart?.attrs).toMatchObject({
      tableName: 'main.t',
      caption: 'A caption',
      config,
    });
  });

  it('falls back to an empty config for missing or malformed data', () => {
    const fromMissing = generateJSON(
      '<div data-type="block-document-chart"></div>',
      extensions,
    );
    const fromMalformed = generateJSON(
      '<div data-type="block-document-chart" data-config="{oops"></div>',
      extensions,
    );

    expect(fromMissing.content?.[0]?.attrs?.config).toEqual({});
    expect(fromMalformed.content?.[0]?.attrs?.config).toEqual({});
  });
});
