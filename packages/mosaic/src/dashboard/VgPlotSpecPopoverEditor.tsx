import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {PencilIcon} from 'lucide-react';
import React, {useCallback, useState} from 'react';
import {MosaicCodeMirrorEditor} from '../editor/MosaicCodeMirrorEditor';

interface VgPlotSpecPopoverEditorProps {
  value: Record<string, unknown>;
  onApply: (value: Record<string, unknown>) => void;
}

export const VgPlotSpecPopoverEditor: React.FC<
  VgPlotSpecPopoverEditorProps
> = ({value, onApply}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setDraft(JSON.stringify(value, null, 2));
      }
    },
    [value],
  );

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(draft);
      onApply(parsed as Record<string, unknown>);
      setOpen(false);
    } catch {
      // Invalid JSON — keep the editor open.
    }
  }, [draft, onApply]);

  const serializedValue = JSON.stringify(value, null, 2);
  const isDirty = draft !== serializedValue;
  let isValidJson = false;
  try {
    JSON.parse(draft);
    isValidJson = true;
  } catch {
    // ignore
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Edit spec"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[500px] p-0"
        onInteractOutside={(event) => {
          if (isDirty) event.preventDefault();
        }}
      >
        <div className="flex flex-col">
          <div className="h-72 overflow-hidden">
            <MosaicCodeMirrorEditor
              value={draft}
              onChange={(nextValue: string | undefined) =>
                setDraft(nextValue ?? '')
              }
              className="h-full"
              enableSchemaValidation
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t p-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!isDirty || !isValidJson}
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
