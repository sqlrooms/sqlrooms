import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentImageNodeView} from '../node-views/BlockDocumentImageNodeView';

export const BlockDocumentChartImageNode = Node.create({
  name: 'blockDocumentChartImage',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      assetId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'figure[data-type="block-document-chart-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'block-document-chart-image',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => (
      <BlockDocumentImageNodeView {...props} label="Chart image" />
    ));
  },
});
