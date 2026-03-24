import {CodeIcon} from 'lucide-react';

export function EditorPanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CodeIcon className="h-4 w-4" />
        Editor
      </div>
      <div className="bg-muted rounded p-4 font-mono text-sm">
        <div className="text-muted-foreground">
          {'-- Write your SQL query here'}
        </div>
        <div className="mt-2">
          <span className="text-blue-500">SELECT</span> *
        </div>
        <div>
          <span className="text-blue-500">FROM</span> sample_data
        </div>
        <div>
          <span className="text-blue-500">WHERE</span> value {'>'} 100
        </div>
        <div>
          <span className="text-blue-500">ORDER BY</span> created_at{' '}
          <span className="text-blue-500">DESC</span>
        </div>
        <div>
          <span className="text-blue-500">LIMIT</span> 50;
        </div>
      </div>
    </div>
  );
}
