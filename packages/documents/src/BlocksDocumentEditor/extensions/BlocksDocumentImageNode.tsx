import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentImageNodeView} from '../node-views/BlocksDocumentImageNodeView';

export const BlocksDocumentImageNode = Node.create({
  name: 'blocksDocumentImage',
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
    return [{tag: 'figure[data-type="blocks-document-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {'data-type': 'blocks-document-image'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlocksDocumentImageNodeView);
  },
});
