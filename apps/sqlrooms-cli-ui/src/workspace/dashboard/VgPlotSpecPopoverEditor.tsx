import {MosaicCodeMirrorEditor} from '@sqlrooms/mosaic';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {PencilIcon} from 'lucide-react';
import React, {useCallback, useEffect, useState} from 'react';

interface VgPlotSpecPopoverEditorProps {
  value: string;
  onApply: (value: string) => void;
}

export const VgPlotSpecPopoverEditor: React.FC<
  VgPlotSpecPopoverEditorProps
> = ({value, onApply}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(draft);
      onApply(JSON.stringify(parsed, null, 2));
      setOpen(false);
    } catch {
      // invalid JSON — do nothing
    }
  }, [draft, onApply]);

  const isDirty = draft !== value;
  let isValidJson = false;
  try {
    JSON.parse(draft);
    isValidJson = true;
  } catch {
    // ignore
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        onInteractOutside={(e) => {
          if (isDirty) e.preventDefault();
        }}
      >
        <div className="flex flex-col">
          <div className="h-72 overflow-hidden">
            <MosaicCodeMirrorEditor
              value={draft}
              onChange={(v) => setDraft(v ?? '')}
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
