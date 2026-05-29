import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentRichTextNodeView} from '../node-views/BlocksDocumentRichTextNodeView';

export const BlocksDocumentRichTextNode = Node.create({
  name: 'blocksDocumentRichText',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      markdown: {default: ''},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="blocks-document-rich-text"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'blocks-document-rich-text'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlocksDocumentRichTextNodeView);
  },
});
