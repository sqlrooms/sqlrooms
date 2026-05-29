import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentStatefulBlockNodeView} from '../node-views/BlockDocumentStatefulBlockNodeView';

export const BlockDocumentStatefulBlockNode = Node.create({
  name: 'blockDocumentStatefulBlock',
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
      height: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="block-document-stateful-block"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'block-document-stateful-block',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockDocumentStatefulBlockNodeView);
  },
});
