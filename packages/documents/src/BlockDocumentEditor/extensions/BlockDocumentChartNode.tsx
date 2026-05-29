import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentChartNodeView} from '../node-views/BlockDocumentChartNodeView';

export const BlockDocumentChartNode = Node.create({
  name: 'blockDocumentChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      tableName: {default: null},
      config: {default: {}},
      selectionGroupId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="block-document-chart"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'block-document-chart'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockDocumentChartNodeView);
  },
});
