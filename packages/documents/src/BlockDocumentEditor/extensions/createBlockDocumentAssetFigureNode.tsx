import {mergeAttributes, Node} from '@tiptap/core';
import {ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentImageNodeView} from '../node-views/BlockDocumentImageNodeView';

export function createBlockDocumentAssetFigureNode({
  name,
  dataType,
  label,
}: {
  name: string;
  dataType: string;
  label?: string;
}) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: false,
    draggable: false,
    isolating: true,

    addAttributes() {
      return {
        id: {default: null},
        assetId: {default: null},
        caption: {default: null},
      };
    },

    parseHTML() {
      return [{tag: `figure[data-type="${dataType}"]`}];
    },

    renderHTML({HTMLAttributes}) {
      return [
        'figure',
        mergeAttributes(HTMLAttributes, {'data-type': dataType}),
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer((props) => (
        <BlockDocumentImageNodeView {...props} label={label} />
      ));
    },
  });
}
