import {cn} from '@sqlrooms/ui';
import {AlertCircle} from 'lucide-react';
import React from 'react';
import {useVegaEditorContext} from './VegaEditorContext';
import {VegaMonacoEditor} from './VegaMonacoEditor';

export interface VegaSpecEditorPanelProps {
  /**
   * Custom class name for the panel
   */
  className?: string;
  /**
   * Title shown in the panel header
   * @default "Vega-Lite Spec"
   */
  title?: string;
}

/**
 * Spec editor panel subcomponent for VegaLiteChart.Container.
 * Renders a Monaco editor with Vega-Lite JSON schema validation.
 *
 * Must be used within a VegaLiteChart.Container component.
 *
 * @example
 * ```tsx
 * <VegaLiteChart.Container spec={spec}>
 *   <VegaLiteChart.Chart />
 *   <VegaLiteChart.SpecEditor />
 * </VegaLiteChart.Container>
 * ```
 */
export const VegaSpecEditorPanel: React.FC<VegaSpecEditorPanelProps> = ({
  className,
  title = 'Vega-Lite Spec',
}) => {
  const {state, actions, editable} = useVegaEditorContext();
  const showHeader = title !== '';

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header - only show if title is provided */}
      {showHeader && (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          {state.isSpecDirty && (
            <span className="text-muted-foreground text-xs">Modified</span>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="relative flex-1">
        <VegaMonacoEditor
          className="absolute inset-0 h-full w-full"
          value={state.editedSpecString}
          onChange={(value) => {
            if (value !== undefined) {
              actions.setEditedSpec(value);
            }
          }}
          readOnly={!editable}
        />
      </div>

      {/* Spec parse error */}
      {state.specParseError && (
        <div className="bg-destructive/90 text-destructive-foreground flex items-center gap-2 px-3 py-2 backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate text-xs">{state.specParseError}</span>
        </div>
      )}
    </div>
  );
};
