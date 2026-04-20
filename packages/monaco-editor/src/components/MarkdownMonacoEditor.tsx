import React from 'react';
import {MonacoEditor, MonacoEditorProps} from './MonacoEditor';

export type MarkdownMonacoEditorProps = Omit<MonacoEditorProps, 'language'>;

/**
 * A Monaco editor configured for editing Markdown files with
 * readable dark/light theme colors for headings, links, lists, and code.
 */
export const MarkdownMonacoEditor: React.FC<MarkdownMonacoEditorProps> = ({
  options: userOptions,
  ...props
}) => {
  return (
    <MonacoEditor
      language="markdown"
      options={{
        wordWrap: 'on',
        ...userOptions,
      }}
      {...props}
    />
  );
};
