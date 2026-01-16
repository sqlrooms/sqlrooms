import {SqlMonacoEditor, SqlQueryPreview} from '@sqlrooms/sql-editor';
import {Button, cn} from '@sqlrooms/ui';
import {PlayIcon} from 'lucide-react';
import React, {useCallback, useState} from 'react';
import {useVegaEditorContext} from './VegaEditorContext';

export interface VegaSqlEditorPanelProps {
  /**
   * Custom class name for the panel
   */
  className?: string;
  /**
   * Title shown in the panel header
   * @default "SQL Query"
   */
  title?: string;
  /**
   * Max rows to fetch for preview
   * @default 100
   */
  maxPreviewRows?: number;
}

/**
 * SQL editor panel subcomponent for VegaLiteChart.Container.
 * Renders a Monaco editor with SQL syntax highlighting and a query preview.
 *
 * Must be used within a VegaLiteChart.Container component.
 *
 * @example
 * ```tsx
 * <VegaLiteChart.Container spec={spec} sqlQuery={query}>
 *   <VegaLiteChart.Chart />
 *   <VegaLiteChart.SqlEditor />
 * </VegaLiteChart.Container>
 * ```
 */
export const VegaSqlEditorPanel: React.FC<VegaSqlEditorPanelProps> = ({
  className,
  title = 'SQL Query',
  maxPreviewRows = 100,
}) => {
  const {state, actions, editable} = useVegaEditorContext();
  const [previewQuery, setPreviewQuery] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const handleRunPreview = useCallback(() => {
    setPreviewQuery(state.editedSql);
    setShowPreview(true);
  }, [state.editedSql]);

  const showHeader = title !== '';

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header - only show if title is provided */}
      {showHeader ? (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          <div className="flex items-center gap-2">
            {state.isSqlDirty && (
              <span className="text-muted-foreground text-xs">Modified</span>
            )}
            {editable && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleRunPreview}
                disabled={!state.editedSql.trim()}
              >
                <PlayIcon className="mr-1 h-3 w-3" />
                Preview
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Toolbar when no header - just show preview button */
        editable && (
          <div className="flex items-center justify-end border-b px-2 py-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRunPreview}
              disabled={!state.editedSql.trim()}
            >
              <PlayIcon className="mr-1 h-3 w-3" />
              Preview
            </Button>
          </div>
        )
      )}

      {/* Editor */}
      <div className="relative min-h-[100px] flex-1">
        <SqlMonacoEditor
          className="absolute inset-0 h-full w-full"
          value={state.editedSql}
          onChange={(value) => {
            if (value !== undefined) {
              actions.setEditedSql(value);
            }
          }}
          options={{
            lineNumbers: 'off',
            fixedOverflowWidgets: false,
          }}
          readOnly={!editable}
        />
      </div>

      {/* Preview Results */}
      {previewQuery && showPreview && (
        <div className="max-h-[200px] overflow-auto border-t">
          <SqlQueryPreview
            query={previewQuery}
            defaultLimit={maxPreviewRows}
            limitOptions={[100, 500, 1000]}
          />
        </div>
      )}
    </div>
  );
};
