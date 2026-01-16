import {QueryToolResult} from '@sqlrooms/ai';
import {useSql} from '@sqlrooms/duckdb';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {EditIcon, TriangleAlertIcon} from 'lucide-react';
import {useEffect, useState} from 'react';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';

export type VegaChartToolResultProps = {
  className?: string;
  reasoning: string;
  sqlQuery: string;
  vegaLiteSpec: VisualizationSpec;
  options?: EmbedOptions;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite
 * @param {VegaChartToolResultProps} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export function VegaChartToolResult({
  className,
  sqlQuery,
  vegaLiteSpec: initialVegaLiteSpec,
  options,
}: VegaChartToolResultProps) {
  const result = useSql({query: sqlQuery});
  const popoverOpen = useDisclosure();
  const editDialogOpen = useDisclosure();
  const [vegaLiteSpec, setVegaLiteSpec] =
    useState<VisualizationSpec>(initialVegaLiteSpec);
  const [editedSpecString, setEditedSpecString] = useState<string>('');

  // Sync local state when initial spec prop changes
  useEffect(() => {
    setVegaLiteSpec(initialVegaLiteSpec);
  }, [initialVegaLiteSpec]);

  const handleEditClick = () => {
    setEditedSpecString(
      typeof vegaLiteSpec === 'string'
        ? vegaLiteSpec
        : JSON.stringify(vegaLiteSpec, null, 2),
    );
    editDialogOpen.onOpen();
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(editedSpecString) as VisualizationSpec;
      setVegaLiteSpec(parsed);
      editDialogOpen.onClose();
    } catch (error) {
      // JSON parse error - could show a toast or error message
      console.error('Invalid JSON:', error);
    }
  };

  const handleCancel = () => {
    editDialogOpen.onClose();
  };

  return (
    <>
      {vegaLiteSpec && (
        <div className="flex flex-col gap-2">
          <QueryToolResult
            title=""
            arrowTable={result.data?.arrowTable}
            sqlQuery={sqlQuery}
          />
          {result.error ? (
            <Popover
              open={popoverOpen.isOpen}
              onOpenChange={popoverOpen.onToggle}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 transition-colors"
                  aria-label="Show error details"
                >
                  <TriangleAlertIcon className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                style={{width: '600px', maxWidth: '80%'}}
              >
                <div className="flex flex-col gap-2">
                  <div className="border-b text-sm font-medium">
                    Query Error
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-sm text-red-500">
                    {result.error?.message}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : result.isLoading ? (
            <div className="text-muted-foreground align-center flex gap-2 px-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              Running query for chart data…
            </div>
          ) : (
            <div className="relative">
              <Button
                className="absolute right-3 top-[40px] z-10"
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleEditClick}
                aria-label="Edit chart specification"
              >
                <EditIcon className="h-4 w-4" />
              </Button>
              <VegaLiteArrowChart
                className={cn('pr-4', className)}
                aspectRatio={16 / 9}
                arrowTable={result.data?.arrowTable}
                spec={vegaLiteSpec}
                options={options}
              />
            </div>
          )}
        </div>
      )}

      <Dialog
        open={editDialogOpen.isOpen}
        onOpenChange={editDialogOpen.onToggle}
      >
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>Edit Chart Specification</DialogTitle>
          </DialogHeader>
          <div className="relative flex h-full min-h-[400px] flex-1 flex-col overflow-hidden">
            <JsonMonacoEditor
              className="absolute inset-0 h-full w-full border"
              value={editedSpecString}
              onChange={(value) => {
                if (value !== undefined) {
                  setEditedSpecString(value);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApply}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
