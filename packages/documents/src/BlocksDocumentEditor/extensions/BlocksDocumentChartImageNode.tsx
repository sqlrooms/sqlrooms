import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentImageNodeView} from '../node-views/BlocksDocumentImageNodeView';

export const BlocksDocumentChartImageNode = Node.create({
  name: 'blocksDocumentChartImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      assetId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'figure[data-type="blocks-document-chart-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {'data-type': 'blocks-document-chart-image'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => (
      <BlocksDocumentImageNodeView {...props} label="Chart image" />
    ));
  },
});
