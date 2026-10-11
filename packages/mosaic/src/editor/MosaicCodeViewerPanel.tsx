import {CopyButton, ScrollArea, cn} from '@sqlrooms/ui';
import type {FC} from 'react';
import {MosaicCodeMirrorEditor} from './MosaicCodeMirrorEditor';

export type MosaicCodeViewerPanelProps = {
  /** Serialized code to display and copy. */
  value: string;
  /** Tooltip text for the copy button. */
  copyTooltipLabel?: string;
  /** Whether to enable Mosaic spec schema validation in the editor. */
  enableSchemaValidation?: boolean;
  /** Additional classes for the scroll area. */
  className?: string;
  /** Additional classes for the CodeMirror editor. */
  editorClassName?: string;
};

/** Read-only CodeMirror viewer with a top-right copy overlay. */
export const MosaicCodeViewerPanel: FC<MosaicCodeViewerPanelProps> = ({
  value,
  copyTooltipLabel = 'Copy code',
  enableSchemaValidation,
  className,
  editorClassName,
}) => {
  return (
    <ScrollArea className={cn('min-h-0 flex-1', className)}>
      <div className="h-full p-2">
        <div className="border-input relative h-full overflow-hidden rounded-md border">
          <MosaicCodeMirrorEditor
            value={value}
            className={cn('h-full', editorClassName)}
            enableSchemaValidation={enableSchemaValidation}
            readOnly
          />
          <div className="bg-background absolute top-2 right-2 rounded-md border">
            <CopyButton
              text={value}
              size="xs"
              tooltipLabel={copyTooltipLabel}
              disabled={!value.trim()}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
