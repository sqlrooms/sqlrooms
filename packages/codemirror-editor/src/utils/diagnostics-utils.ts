import {forEachDiagnostic} from '@codemirror/lint';
import {EditorState} from '@codemirror/state';

export type CodeMirrorDiagnostic = {
  from: number;
  to: number;
  severity: 'hint' | 'info' | 'warning' | 'error';
  message: string;
};

export function getDiagnostics(
  editorState: EditorState,
): CodeMirrorDiagnostic[] {
  const diagnostics: CodeMirrorDiagnostic[] = [];

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
