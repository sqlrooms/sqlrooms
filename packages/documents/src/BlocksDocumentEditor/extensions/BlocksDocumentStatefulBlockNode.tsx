import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentStatefulBlockNodeView} from '../node-views/BlocksDocumentStatefulBlockNodeView';

export const BlocksDocumentStatefulBlockNode = Node.create({
  name: 'blocksDocumentStatefulBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      blockType: {default: null},
      blockInstanceId: {default: null},
      ownership: {default: 'owned'},
      title: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="blocks-document-stateful-block"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'blocks-document-stateful-block',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlocksDocumentStatefulBlockNodeView);
  },
});
