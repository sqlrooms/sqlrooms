import {LeafLayout, useExpandGridPanel} from '@sqlrooms/layout';
import {GripVerticalIcon, MoveHorizontalIcon, XIcon} from 'lucide-react';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {FC, useCallback} from 'react';
import {useRoomStore} from '../store';

type DynamicChartHeaderProps = {
  title: string;
  chartId: string;
};

export const DynamicChartHeader: FC<DynamicChartHeaderProps> = ({
  title,
  chartId,
}) => {
  const togglePanel = useRoomStore((state) => state.layout.togglePanel);
  const {canExpandGridPanel, expandGridPanel, isGridPanelHorizontallyExpanded} =
    useExpandGridPanel();
  const expandLabel = isGridPanelHorizontallyExpanded
    ? 'Shrink panel horizontally'
    : 'Expand panel horizontally';

  const handleRemove = useCallback(() => {
    togglePanel(chartId, false);
  }, [chartId, togglePanel]);

  return (
    <>
      <LeafLayout.Header>
        <div className="text-muted-foreground flex h-8 w-full border-b">
          <div className="flex h-full min-w-0 flex-1 gap-1">
            <LeafLayout.DragHandle className="flex min-w-0 flex-1 items-center gap-1">
              <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
              <span className="truncate">{title}</span>
            </LeafLayout.DragHandle>
          </div>
          <TooltipProvider delayDuration={300}>
            <div className="flex shrink-0">
              {canExpandGridPanel ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={expandLabel}
                      onClick={expandGridPanel}
                      className="hover:text-foreground h-8 w-8 transition-colors"
                    >
                      <MoveHorizontalIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{expandLabel}</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove chart"
                    onClick={handleRemove}
                    className="hover:text-foreground h-8 w-8 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove chart</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </LeafLayout.Header>
    </>
  );
};
