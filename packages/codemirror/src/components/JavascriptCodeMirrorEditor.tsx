import React, {useMemo} from 'react';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {javascript} from '@codemirror/lang-javascript';
import {createSqlroomsTheme} from '../themes/sqlrooms-theme';

export type JavascriptCodeMirrorEditorProps = CodeMirrorEditorProps;

/**
 * A CodeMirror editor for editing JavaScript
 */
export const JavascriptCodeMirrorEditor: React.FC<
  JavascriptCodeMirrorEditorProps
> = ({value = '', extensions: userExtensions = [], options = {}, ...props}) => {
  // Build JavaScript-specific extensions
  const extensions = useMemo(() => {
    return [
      javascript({
        jsx: true,
      }),
      createSqlroomsTheme(),
      ...userExtensions,
    ];
  }, [userExtensions]);

  return (
    <CodeMirrorEditor
      value={value}
      extensions={extensions}
      options={{
        lineNumbers: options.lineNumbers ?? false,
        lineWrapping: options.lineWrapping ?? true,
        autocompletion: true,
        foldGutter: options.foldGutter ?? false,
        ...options,
      }}
      {...props}
    />
  );
};
