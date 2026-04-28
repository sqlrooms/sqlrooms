import {Button} from '@sqlrooms/ui';
import type {FC} from 'react';

export type SuggestionStripProps = {
  suggestions: string[];
  onPick: (text: string) => void;
};

/**
 * Prompt chips shown above the composer before the first message is sent.
 * Clicking a chip sends it immediately.
 */
export const SuggestionStrip: FC<SuggestionStripProps> = ({
  suggestions,
  onPick,
}) => {
  return (
    <div className="border-border flex flex-wrap gap-2 border-t px-3 py-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion}
          variant="outline"
          size="sm"
          type="button"
          onClick={() => onPick(suggestion)}
          className="h-auto max-w-xs justify-start text-left text-xs font-normal whitespace-normal"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
};
