import {Button, Textarea} from '@sqlrooms/ui';
import {useCallback, useState} from 'react';
import {Field} from '../../chart-builders/Field';

export interface BuildDashboardWithAIPanelProps {
  onStart?: (prompt: string) => void | Promise<void>;
  isStarting: boolean;
  onStartingChange: (isStarting: boolean) => void;
}

export const BuildDashboardWithAIPanel: React.FC<
  BuildDashboardWithAIPanelProps
> = ({onStart, isStarting, onStartingChange}) => {
  const [prompt, setPrompt] = useState<string>('');

  const handleStart = useCallback(async () => {
    if (!prompt.trim()) return;

    onStartingChange(true);
    try {
      if (onStart) {
        await onStart(prompt);
      }
    } finally {
      onStartingChange(false);
    }
  }, [prompt, onStart, onStartingChange]);

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6">
      <div>
        <h3 className="mb-1 font-medium">Analyze with AI</h3>
        <p className="text-muted-foreground text-sm">
          Describe what you want to explore and let AI build the dashboard
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Field label="What would you like to analyze?" required>
          <div className="space-y-1">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Show me sales trends over time, identify top customers, analyze seasonal patterns..."
              rows={6}
              className="resize-none"
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  (e.metaKey || e.ctrlKey) &&
                  prompt.trim()
                ) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />
            <p className="text-muted-foreground text-xs">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to
              analyze
            </p>
          </div>
        </Field>
        <Button
          className="mt-auto w-full"
          disabled={!prompt.trim() || isStarting}
          onClick={handleStart}
        >
          {isStarting ? 'Starting...' : 'Analyze with AI'}
        </Button>
      </div>
    </div>
  );
};
