import {mergeAttributes, Node} from '@tiptap/react';

export const BLOCK_DOCUMENT_TITLE_NODE_NAME = 'blockDocumentTitle';

export const BlockDocumentTitleNode = Node.create({
  name: BLOCK_DOCUMENT_TITLE_NODE_NAME,
  group: 'block',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{tag: 'h1[data-type="block-document-title"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'h1',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'block-document-title',
        class:
          'text-foreground !m-0 !text-4xl !leading-tight font-bold tracking-normal',
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    const isInTitle = () =>
      this.editor.state.selection.$from.parent.type.name === this.name;

    return {
      Enter: () => {
        if (!isInTitle()) return false;
        const {state, view} = this.editor;
        const paragraph = state.schema.nodes.paragraph;
        if (!paragraph) return false;
        const depth = state.selection.$from.depth;
        const insertPos = state.selection.$from.after(depth);
        view.dispatch(state.tr.insert(insertPos, paragraph.create()));
        this.editor.commands.setTextSelection(insertPos + 1);
        this.editor.commands.scrollIntoView();
        return true;
      },
      Backspace: () =>
        isInTitle() &&
        this.editor.state.selection.empty &&
        this.editor.state.selection.$from.parentOffset === 0,
      Delete: () =>
        isInTitle() &&
        this.editor.state.selection.empty &&
        this.editor.state.selection.$from.parentOffset ===
          this.editor.state.selection.$from.parent.content.size,
    };
  },
});
