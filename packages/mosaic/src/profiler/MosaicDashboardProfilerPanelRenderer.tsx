import {SpinnerPane} from '@sqlrooms/ui';
import {TablePropertiesIcon} from 'lucide-react';
import {MosaicProfiler, type MosaicProfilerProps} from './MosaicProfiler';
import {
  type MosaicDashboardPanelRenderer,
  ProfilerPanel,
  type ProfilerPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';

function MosaicDashboardProfilerRenderer({
  panel,
  dashboard,
  selectionName,
}: ProfilerPanelRendererProps) {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const tableName = dashboard.selectedTable;
  const pageSize =
    typeof panel.config.pageSize === 'number'
      ? panel.config.pageSize
      : undefined;

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Data Table panels require a table source.
      </div>
    );
  }

  if (connection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (connection.status !== 'ready') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Mosaic connection is not ready.
      </div>
    );
  }

  const profilerProps = {
    tableName,
    pageSize: pageSize ?? 10,
    selectionName,
  } satisfies MosaicProfilerProps;

  return (
    <MosaicProfiler {...profilerProps}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <MosaicProfiler.Table>
            <MosaicProfiler.Header />
            <MosaicProfiler.Rows />
          </MosaicProfiler.Table>
        </div>
        <MosaicProfiler.StatusBar />
      </div>
    </MosaicProfiler>
  );
}

export const mosaicDashboardProfilerPanelRenderer: MosaicDashboardPanelRenderer<ProfilerPanel> =
  {
    component: MosaicDashboardProfilerRenderer,
    icon: TablePropertiesIcon,
  };
