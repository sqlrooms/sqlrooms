import React, {useMemo} from 'react';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {javascript} from '@codemirror/lang-javascript';
import {createSqlroomsTheme} from '../themes/sqlrooms-theme';
import {Theme, useIsDarkTheme} from '@sqlrooms/ui';

export interface JavascriptCodeMirrorEditorProps extends CodeMirrorEditorProps {
  theme?: Theme;
}

/**
 * A CodeMirror editor for editing JavaScript
 */
export const JavascriptCodeMirrorEditor: React.FC<
  JavascriptCodeMirrorEditorProps
> = ({
  value = '',
  extensions: userExtensions = [],
  options = {},
  theme: explicitTheme,
  ...props
}) => {
  const isDark = useIsDarkTheme(explicitTheme);

  // Build JavaScript-specific extensions
  const extensions = useMemo(() => {
    return [javascript(), createSqlroomsTheme(isDark), ...userExtensions];
  }, [userExtensions, isDark]);

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
