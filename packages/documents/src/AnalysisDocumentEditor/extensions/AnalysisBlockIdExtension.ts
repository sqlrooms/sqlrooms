import {Extension} from '@tiptap/react';

export const analysisBlockNodeTypesWithIds = [
  'heading',
  'paragraph',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'taskList',
  'analysisRichText',
  'analysisImage',
  'analysisChartImage',
  'analysisChart',
  'analysisArtifactEmbed',
];

export const AnalysisBlockIdExtension = Extension.create({
  name: 'analysisBlockId',

  addGlobalAttributes() {
    return [
      {
        types: analysisBlockNodeTypesWithIds,
        attributes: {
          id: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute('data-analysis-block-id'),
            renderHTML: (attributes) => {
              if (typeof attributes.id !== 'string') return {};
              return {'data-analysis-block-id': attributes.id};
            },
          },
        },
      },
    ];
  },
});
