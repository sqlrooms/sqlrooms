import {Button} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import {type FC, useCallback, useMemo} from 'react';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';
import {
  VgPlotPanelConfig,
  type VgPlotPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {generateMosaicChartSpec} from './generateMosaicChartSpec';

function getVgPlotSpec(panel: VgPlotPanelConfig) {
  // For custom-spec, use the vgplot from config
  if (panel.config.chartType === 'custom-spec') {
    const spec = panel.config.vgplot;
    return spec && typeof spec === 'object' && !Array.isArray(spec)
      ? (spec as Record<string, unknown>)
      : null;
  }

  // For all other chart types, generate spec on the fly
  const tableName = panel.source?.tableName;
  if (!tableName) {
    return null;
  }

  const generatedSpec = generateMosaicChartSpec(
    tableName,
    panel.config.chartType,
    panel.config.settings,
  );

  return generatedSpec &&
    typeof generatedSpec === 'object' &&
    !Array.isArray(generatedSpec)
    ? (generatedSpec as unknown as Record<string, unknown>)
    : null;
}

export const MosaicDashboardVgPlotHeaderActions: FC<
  VgPlotPanelRendererProps
> = ({dashboardId, panel}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const spec = useMemo(() => getVgPlotSpec(panel), [panel]);
  const isSettingsOpen = Boolean(panel.config.settingsOpen);

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
        className="data-[state=active]:bg-accent h-6 w-6"
        title="Chart settings"
        onClick={handleToggleSettings}
        data-state={isSettingsOpen ? 'active' : 'inactive'}
      >
        <SettingsIcon className="h-3.5 w-3.5" />
      </Button>
      {spec ? <VgPlotSpecPopoverEditor value={spec} readonly /> : null}
    </>
  );
};
