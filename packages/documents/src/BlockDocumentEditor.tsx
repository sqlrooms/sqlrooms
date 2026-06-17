import {BlockDocumentEditorContent} from './BlockDocumentEditor/BlockDocumentEditorContent';
import {BlockDocumentEditorRoot} from './BlockDocumentEditor/BlockDocumentEditorRoot';
import {BlockDocumentToolbar} from './BlockDocumentEditor/BlockDocumentToolbar';

export const BlockDocumentEditor = Object.assign(BlockDocumentEditorRoot, {
  Toolbar: BlockDocumentToolbar,
  Content: BlockDocumentEditorContent,
});
