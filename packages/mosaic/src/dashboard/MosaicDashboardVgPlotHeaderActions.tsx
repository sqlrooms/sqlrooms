import {Button} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import {type FC, useCallback} from 'react';
import {
  type VgPlotPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

export const MosaicDashboardVgPlotHeaderActions: FC<
  VgPlotPanelRendererProps
> = ({dashboardId, panel}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const isSettingsOpen = Boolean(panel.config.settingsOpen);

  const handleToggleSettings = useCallback(() => {
    updatePanel(dashboardId, panel.id, {
      config: {...panel.config, settingsOpen: !isSettingsOpen},
    });
  }, [dashboardId, isSettingsOpen, panel.config, panel.id, updatePanel]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="data-[state=active]:bg-accent h-6 w-6"
      title="Chart settings"
      onClick={handleToggleSettings}
      data-state={isSettingsOpen ? 'active' : 'inactive'}
    >
      <SettingsIcon className="h-3.5 w-3.5" />
    </Button>
  );
};
