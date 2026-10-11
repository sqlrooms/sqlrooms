import {MarkdownDocumentEditorContent} from './MarkdownDocumentEditor/MarkdownDocumentEditorContent';
import {MarkdownDocumentEditorRoot} from './MarkdownDocumentEditor/MarkdownDocumentEditorRoot';
import {MarkdownDocumentEditorToolbar} from './MarkdownDocumentEditor/MarkdownDocumentEditorToolbar';

export const MarkdownDocumentEditor = Object.assign(
  MarkdownDocumentEditorRoot,
  {
    Toolbar: MarkdownDocumentEditorToolbar,
    Content: MarkdownDocumentEditorContent,
  },
);
