import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentRichTextNodeView} from '../node-views/BlockDocumentRichTextNodeView';

export const BlockDocumentRichTextNode = Node.create({
  name: 'blockDocumentRichText',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      markdown: {default: ''},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="block-document-rich-text"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'block-document-rich-text',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockDocumentRichTextNodeView);
  },
});
