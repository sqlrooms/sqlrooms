import {Button} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import {type FC, useCallback} from 'react';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';
import {
  VgPlotPanelConfig,
  type VgPlotPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

function getVgPlotSpec(panel: VgPlotPanelConfig) {
  const spec = panel.config.vgplot;
  return spec && typeof spec === 'object' && !Array.isArray(spec)
    ? (spec as Record<string, unknown>)
    : null;
}

export const MosaicDashboardVgPlotHeaderActions: FC<
  VgPlotPanelRendererProps
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
      {spec ? (
        <VgPlotSpecPopoverEditor value={spec} onApply={handleSpecApply} />
      ) : null}
    </>
  );
};
