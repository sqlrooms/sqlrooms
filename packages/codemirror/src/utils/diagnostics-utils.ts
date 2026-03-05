import {Diagnostic, forEachDiagnostic} from '@codemirror/lint';
import {EditorState} from '@codemirror/state';

export function getDiagnostics(editorState: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  forEachDiagnostic(editorState, ({from, to, severity, message}) => {
    diagnostics.push({
      from,
      to,
      severity,
      message,
    });
  });

  return diagnostics;
}
