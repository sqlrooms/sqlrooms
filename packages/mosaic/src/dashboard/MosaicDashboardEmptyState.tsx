import {Button} from '@sqlrooms/ui';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {useAddPanelActions} from './useAddPanelActions';

export const MosaicDashboardEmptyState: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();
  const {actions, canAddPanel, handleAddPanel} =
    useAddPanelActions(dashboardId);

  // Show panel selection screen if table is selected
  return (
    <div className="m-4 flex min-h-[240px] items-center justify-center rounded-md border border-dashed p-8">
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">
          Add a chart, profiler, map, or text to start building this dashboard
        </p>
        <div className="flex gap-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={action.type}
                variant="outline"
                disabled={!canAddPanel(action)}
                onClick={() => handleAddPanel(action)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
