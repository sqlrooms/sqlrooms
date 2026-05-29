import {BlocksDocumentEditorContent} from './BlocksDocumentEditor/BlocksDocumentEditorContent';
import {BlocksDocumentEditorRoot} from './BlocksDocumentEditor/BlocksDocumentEditorRoot';
import {BlocksDocumentToolbar} from './BlocksDocumentEditor/BlocksDocumentToolbar';

export const BlocksDocumentEditor = Object.assign(
  BlocksDocumentEditorRoot,
  {
    Toolbar: BlocksDocumentToolbar,
    Content: BlocksDocumentEditorContent,
  },
);
