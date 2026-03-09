import React, {useState} from 'react';
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {type EditorType} from './EditorTypeSwitch';
import {userProfileSchema, initialUserData} from './user-profile-schema';

interface JsonEditorProps {
  editorType: EditorType;
  className?: string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  editorType,
  className,
}) => {
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialUserData, null, 2),
  );
  if (editorType === 'monaco') {
    return (
      <JsonMonacoEditor
        schema={userProfileSchema}
        value={jsonValue}
        onChange={(value) => setJsonValue(value || '')}
        className={className}
        options={{
          minimap: {enabled: false},
          lineNumbers: 'on',
          wordWrap: 'on',
        }}
      />
    );
  }

  return (
    <JsonCodeMirrorEditor
      schema={userProfileSchema}
      value={jsonValue}
      onChange={(value) => setJsonValue(value)}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
