import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {AnalysisImageNodeView} from '../node-views/AnalysisImageNodeView';

export const AnalysisImageNode = Node.create({
  name: 'analysisImage',
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
    return [{tag: 'figure[data-type="analysis-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {'data-type': 'analysis-image'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnalysisImageNodeView);
  },
});
