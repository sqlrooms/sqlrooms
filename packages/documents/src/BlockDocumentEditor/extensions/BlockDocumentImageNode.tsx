import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentImageNodeView} from '../node-views/BlockDocumentImageNodeView';

export const BlockDocumentImageNode = Node.create({
  name: 'blockDocumentImage',
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
    return [{tag: 'figure[data-type="block-document-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {'data-type': 'block-document-image'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockDocumentImageNodeView);
  },
});
