import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {AnalysisRichTextNodeView} from '../node-views/AnalysisRichTextNodeView';

export const AnalysisRichTextNode = Node.create({
  name: 'analysisRichText',
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
    return [{tag: 'div[data-type="analysis-rich-text"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'analysis-rich-text'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnalysisRichTextNodeView);
  },
});
