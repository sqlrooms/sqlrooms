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
import {useState} from 'react';
import {useVegaEditorContext} from './editor/VegaEditorContext';
import {VegaSpecEditorPanel} from './editor/VegaSpecEditorPanel';
import {VegaSqlEditorPanel} from './editor/VegaSqlEditorPanel';
import {EditorMode} from './editor/types';

export interface VegaEditActionProps {
  /**
   * Which editors to show: 'spec', 'sql', or 'both'
   * @default 'both'
   */
  editorMode?: EditorMode;
  /**
   * Additional CSS classes for the trigger button
   */
  className?: string;
}

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
 * Edit action component for VegaLiteArrowChart.
 * Provides a popover with tabbed Vega-Lite spec and SQL editors.
 *
 * Must be used within a VegaChartContainer to access editor context.
 *
 * @example
 * ```tsx
 * <VegaChartContainer spec={spec} sqlQuery={query} editable>
 *   <VegaChartDisplay>
 *     <VegaLiteArrowChart.Actions>
 *       <VegaExportAction />
 *       <VegaEditAction editorMode="both" />
 *     </VegaLiteArrowChart.Actions>
 *   </VegaChartDisplay>
 * </VegaChartContainer>
 * ```
 *
 * @example
 * ```tsx
 * // Spec editor only
 * <VegaEditAction editorMode="spec" />
 * ```
 */
export const VegaEditAction: React.FC<VegaEditActionProps> = ({
  editorMode = 'both',
  className,
}) => {
  const editorPopover = useDisclosure();
  const [activeTab, setActiveTab] = useState<'spec' | 'sql'>('spec');

  const showSpecEditor = editorMode === 'spec' || editorMode === 'both';
  const showSqlEditor = editorMode === 'sql' || editorMode === 'both';
  const showTabs = showSpecEditor && showSqlEditor;

  return (
    <Popover open={editorPopover.isOpen} onOpenChange={editorPopover.onToggle}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(className)}
          aria-label="Edit chart specification"
        >
          <EditIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-[400px] p-0">
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
                    <TabsTrigger value="spec" className="h-6 px-2 text-xs">
                      <Code2 className="mr-1 h-3 w-3" />
                      Spec
                    </TabsTrigger>
                    <TabsTrigger value="sql" className="h-6 px-2 text-xs">
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
  );
};
