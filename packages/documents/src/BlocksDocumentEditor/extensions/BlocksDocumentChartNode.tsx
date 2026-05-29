import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentChartNodeView} from '../node-views/BlocksDocumentChartNodeView';

export const BlocksDocumentChartNode = Node.create({
  name: 'blocksDocumentChart',
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
    return [{tag: 'div[data-type="blocks-document-chart"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'blocks-document-chart'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlocksDocumentChartNodeView);
  },
});
