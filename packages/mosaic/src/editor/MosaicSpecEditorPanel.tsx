import {cn} from '@sqlrooms/ui';
import {AlertCircle} from 'lucide-react';
import React from 'react';
import {useMosaicEditorContext} from './MosaicEditorContext';
import {MosaicCodeMirrorEditor} from './MosaicCodeMirrorEditor';

export interface MosaicSpecEditorPanelProps {
  /**
   * Custom class name for the panel
   */
  className?: string;
  /**
   * Title shown in the panel header
   * @default "Mosaic Spec"
   */
  title?: string;
}

/**
 * Spec editor panel subcomponent for MosaicChart.Container.
 * Renders a CodeMirror editor with Mosaic JSON schema validation.
 *
 * Must be used within a MosaicChart.Container component.
 */
export const MosaicSpecEditorPanel: React.FC<MosaicSpecEditorPanelProps> = ({
  className,
  title = 'Mosaic Spec',
}) => {
  const {state, actions, editable} = useMosaicEditorContext();
  const showHeader = title !== '';

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {showHeader && (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          {state.isSpecDirty && (
            <span className="text-muted-foreground text-xs">Modified</span>
          )}
        </div>
      )}

      <div className="relative flex-1">
        <MosaicCodeMirrorEditor
          className="absolute inset-0 h-full w-full"
          value={state.editedSpecString}
          onChange={(value) => {
            if (value !== undefined) {
              actions.setEditedSpec(value);
            }
          }}
          readOnly={!editable}
          options={{
            lineNumbers: true,
            lineWrapping: false,
            foldGutter: true,
          }}
        />
      </div>

      {state.specParseError && (
        <div className="bg-destructive/90 text-destructive-foreground flex items-center gap-2 px-3 py-2 backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs">{state.specParseError}</span>
        </div>
      )}
    </div>
  );
};
