import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {AnalysisArtifactEmbedNodeView} from '../node-views/AnalysisArtifactEmbedNodeView';

export const AnalysisArtifactEmbedNode = Node.create({
  name: 'analysisArtifactEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      artifactId: {default: null},
      artifactType: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="analysis-artifact-embed"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'analysis-artifact-embed',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnalysisArtifactEmbedNodeView);
  },
});
