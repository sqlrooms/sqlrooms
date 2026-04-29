import {Button} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import {type FC, useCallback} from 'react';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';
import {
  type MosaicDashboardPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

function getVgPlotSpec(panel: MosaicDashboardPanelRendererProps['panel']) {
  const spec = panel.config.vgplot;
  return spec && typeof spec === 'object' && !Array.isArray(spec)
    ? (spec as Record<string, unknown>)
    : null;
}

export const MosaicDashboardVgPlotHeaderActions: FC<
  MosaicDashboardPanelRendererProps
> = ({dashboardId, panel}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const spec = getVgPlotSpec(panel);
  const isSettingsOpen = Boolean(panel.config.settingsOpen);

  const handleSpecApply = useCallback(
    (newSpec: Record<string, unknown>) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, vgplot: newSpec},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );

  const handleToggleSettings = useCallback(() => {
    updatePanel(dashboardId, panel.id, {
      config: {...panel.config, settingsOpen: !isSettingsOpen},
    });
  }, [dashboardId, isSettingsOpen, panel.config, panel.id, updatePanel]);

  if (!spec) {
    return (
      <Button variant="ghost" size="sm" className="h-6 px-2" disabled>
        Invalid spec
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title="Chart settings"
        onClick={handleToggleSettings}
        data-state={isSettingsOpen ? 'active' : 'inactive'}
      >
        <SettingsIcon className="h-3.5 w-3.5" />
      </Button>
      <VgPlotSpecPopoverEditor value={spec} onApply={handleSpecApply} />
    </>
  );
};
