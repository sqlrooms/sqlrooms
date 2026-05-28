import {AnalysisDocumentEditorContent} from './AnalysisDocumentEditor/AnalysisDocumentEditorContent';
import {AnalysisDocumentEditorRoot} from './AnalysisDocumentEditor/AnalysisDocumentEditorRoot';
import {AnalysisDocumentToolbar} from './AnalysisDocumentEditor/AnalysisDocumentToolbar';

export const AnalysisDocumentEditor = Object.assign(
  AnalysisDocumentEditorRoot,
  {
    Toolbar: AnalysisDocumentToolbar,
    Content: AnalysisDocumentEditorContent,
  },
);
