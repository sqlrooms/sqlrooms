import {useStoreWithAi} from '@sqlrooms/ai';
import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {Check, Code2, Database, EditIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {VegaChartContainer} from './editor/VegaChartContainer';
import {VegaChartDisplay} from './editor/VegaChartDisplay';
import {useVegaEditorContext} from './editor/VegaEditorContext';
import {VegaSpecEditorPanel} from './editor/VegaSpecEditorPanel';
import {VegaSqlEditorPanel} from './editor/VegaSqlEditorPanel';
import {EditorMode} from './editor/types';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';
import {VegaExportAction} from './VegaExportAction';

export type VegaChartToolResultProps = {
  className?: string;
  reasoning: string;
  sqlQuery: string;
  vegaLiteSpec: VisualizationSpec;
  options?: EmbedOptions;
  /**
   * Tool call ID for AI slice integration (enables persistence)
   */
  toolCallId?: string;
  /**
   * Whether editing is enabled
   * @default true
   */
  editable?: boolean;
  /**
   * Which editors to show when editing
   * @default 'both'
   */
  editorMode?: EditorMode;
};

/**
 * Inline editor actions component (Discard + Apply)
 */
function EditorActions({onClose}: {onClose: () => void}) {
  const {actions, canApply, hasChanges} = useVegaEditorContext();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          actions.cancelChanges();
        }}
        disabled={!hasChanges}
        title="Discard changes"
      >
        Discard
      </Button>
      <Button
        variant="default"
        size="xs"
        onClick={() => {
          actions.applyChanges();
          onClose();
        }}
        disabled={!canApply}
        title="Apply changes"
      >
        <Check className="mr-1 h-3 w-3" />
        Apply
      </Button>
    </div>
  );
}

/**
 * Renders a chart tool call with visualization using Vega-Lite.
 * Supports inline editing with AI slice persistence.
 *
 * @param {VegaChartToolResultProps} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export function VegaChartToolResult({
  className,
  sqlQuery,
  vegaLiteSpec,
  options,
  toolCallId,
  editable = true,
  editorMode = 'both',
}: VegaChartToolResultProps) {
  const editorPopover = useDisclosure();
  const [activeTab, setActiveTab] = useState<'spec' | 'sql'>('spec');

  // AI slice integration for persisting changes
  const setToolAdditionalData = useStoreWithAi(
    (s) => s.ai.setSessionToolAdditionalData,
  );
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const currentSessionId = currentSession?.id;

  // Track applied values for callbacks (to persist both spec and sql together)
  const [appliedSpec, setAppliedSpec] = useState(vegaLiteSpec);
  const [appliedSql, setAppliedSql] = useState(sqlQuery);

  // Callbacks to persist changes to AI slice
  const handleSpecChange = useCallback(
    (newSpec: VisualizationSpec) => {
      setAppliedSpec(newSpec);
      if (toolCallId && currentSessionId) {
        setToolAdditionalData(currentSessionId, toolCallId, {
          sqlQuery: appliedSql,
          vegaLiteSpec: newSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSql, setToolAdditionalData],
  );

  const handleSqlChange = useCallback(
    (newSql: string) => {
      setAppliedSql(newSql);
      if (toolCallId && currentSessionId) {
        setToolAdditionalData(currentSessionId, toolCallId, {
          sqlQuery: newSql,
          vegaLiteSpec: appliedSpec,
        });
      }
    },
    [toolCallId, currentSessionId, appliedSpec, setToolAdditionalData],
  );

  const showSpecEditor = editorMode === 'spec' || editorMode === 'both';
  const showSqlEditor = editorMode === 'sql' || editorMode === 'both';
  const showTabs = showSpecEditor && showSqlEditor;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <VegaChartContainer
        spec={vegaLiteSpec}
        sqlQuery={sqlQuery}
        options={options}
        editable={editable}
        onSpecChange={handleSpecChange}
        onSqlChange={handleSqlChange}
      >
        {/* Chart with edit popover */}
        <div className="relative min-h-[300px]">
          <VegaChartDisplay aspectRatio={16 / 9}>
            <VegaLiteArrowChart.Actions className="right-3 top-[-1px]">
              <VegaExportAction />
            </VegaLiteArrowChart.Actions>
          </VegaChartDisplay>

          {/* Edit button with popover */}
          {editable && (
            <Popover
              open={editorPopover.isOpen}
              onOpenChange={editorPopover.onToggle}
            >
              <PopoverTrigger asChild>
                <Button
                  className="absolute right-[40px] top-0"
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label="Edit chart specification"
                >
                  <EditIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="w-[400px] p-0"
              >
                <div className="flex h-[400px] flex-col">
                  {/* Header with tabs */}
                  <div className="flex items-center justify-between border-b px-2 py-1">
                    {showTabs ? (
                      <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as 'spec' | 'sql')}
                        className="w-full"
                      >
                        <div className="flex items-center justify-between">
                          <TabsList className="h-7">
                            <TabsTrigger
                              value="spec"
                              className="h-6 px-2 text-xs"
                            >
                              <Code2 className="mr-1 h-3 w-3" />
                              Spec
                            </TabsTrigger>
                            <TabsTrigger
                              value="sql"
                              className="h-6 px-2 text-xs"
                            >
                              <Database className="mr-1 h-3 w-3" />
                              SQL
                            </TabsTrigger>
                          </TabsList>
                          <EditorActions onClose={editorPopover.onClose} />
                        </div>
                      </Tabs>
                    ) : (
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-medium">
                          {showSpecEditor ? 'Vega-Lite Spec' : 'SQL Query'}
                        </span>
                        <EditorActions onClose={editorPopover.onClose} />
                      </div>
                    )}
                  </div>

                  {/* Editor content */}
                  <div className="flex-1 overflow-hidden">
                    {showTabs ? (
                      <Tabs value={activeTab} className="h-full">
                        <TabsContent value="spec" className="mt-0 h-full">
                          <VegaSpecEditorPanel title="" className="h-full" />
                        </TabsContent>
                        <TabsContent value="sql" className="mt-0 h-full">
                          <VegaSqlEditorPanel title="" className="h-full" />
                        </TabsContent>
                      </Tabs>
                    ) : showSpecEditor ? (
                      <VegaSpecEditorPanel title="" className="h-full" />
                    ) : (
                      <VegaSqlEditorPanel title="" className="h-full" />
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </VegaChartContainer>
    </div>
  );
}
