import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlocksDocumentArtifactEmbedNodeView} from '../node-views/BlocksDocumentArtifactEmbedNodeView';

export const BlocksDocumentArtifactEmbedNode = Node.create({
  name: 'blocksDocumentArtifactEmbed',
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
    return [{tag: 'div[data-type="blocks-document-artifact-embed"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'blocks-document-artifact-embed',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlocksDocumentArtifactEmbedNodeView);
  },
});
