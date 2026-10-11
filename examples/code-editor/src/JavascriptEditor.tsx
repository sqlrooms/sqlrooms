import React, {useState} from 'react';
import {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {type EditorType} from './EditorTypeSwitch';

// Example JavaScript code
const initialJavascriptCode = `// Sample JavaScript code
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 10 Fibonacci numbers
const numbers = Array.from({length: 10}, (_, i) => fibonacci(i));
console.log('Fibonacci sequence:', numbers);

// Example async function
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

export {fibonacci, fetchData};`;

interface JavascriptEditorProps {
  editorType: EditorType;
  className?: string;
}

export const JavascriptEditor: React.FC<JavascriptEditorProps> = ({
  editorType,
  className,
}) => {
  const [javascriptValue, setJavascriptValue] = useState(initialJavascriptCode);
  if (editorType === 'monaco') {
    return (
      <MonacoEditor
        language="javascript"
        value={javascriptValue}
        onChange={(value) => setJavascriptValue(value || '')}
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
    <JavascriptCodeMirrorEditor
      value={javascriptValue}
      onChange={(value) => setJavascriptValue(value)}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
