import {useCallback, useState} from 'react';
import {
  Icons,
  MapControlButton,
  MapControlPanelFactory,
  MapControlTooltipFactory,
  MapLegendFactory,
  MapLegendPanelFactory,
  MapLegendPanelProps,
} from '@kepler.gl/components';

CustomMapLegendPanelFactory.deps = MapLegendPanelFactory.deps;

export function CustomMapLegendPanelFactory(
  MapControlTooltip: ReturnType<typeof MapControlTooltipFactory>,
  MapControlPanel: ReturnType<typeof MapControlPanelFactory>,
  MapLegend: ReturnType<typeof MapLegendFactory>,
): ReturnType<typeof MapLegendPanelFactory> {
  const OriginalMapLegendPanel = MapLegendPanelFactory(
    MapControlTooltip,
    MapControlPanel,
    MapLegend,
  );

  const SplitPaneLegend = (
    props: MapLegendPanelProps & {mapIndex?: number},
  ) => {
    const [isActive, setIsActive] = useState(false);
    const mapLegend = props.mapControls?.mapLegend;

    const toggleLegend = useCallback((e?: React.MouseEvent) => {
      e?.preventDefault();
      setIsActive((prev) => !prev);
    }, []);

    if (!mapLegend?.show) return null;

    return isActive ? (
      <>
        <style>{`.split-legend .map-control__panel-header { display: none !important; }`}</style>
        <div className="split-legend">
          <MapControlPanel
            scale={props.scale}
            header="header.layerLegend"
            onClick={toggleLegend}
            pinnable={false}
            disableClose={false}
            isExport={props.isExport}
            logoComponent={props.logoComponent}
          >
            <MapLegend
              layers={props.layers}
              mapState={props.mapState}
              disableEdit={mapLegend.disableEdit}
              isExport={props.isExport}
              onLayerVisConfigChange={props.onLayerVisConfigChange}
              onToggleLayerVisibility={props.onToggleLayerVisibility}
              {...({onClose: toggleLegend} as any)}
            />
          </MapControlPanel>
        </div>
      </>
    ) : (
      <MapControlTooltip id="show-legend" message="tooltip.showLegend">
        <MapControlButton
          className="map-control-button show-legend"
          onClick={toggleLegend}
        >
          <Icons.Legend height="22px" />
        </MapControlButton>
      </MapControlTooltip>
    );
  };

  const CustomMapLegendPanel = (
    props: MapLegendPanelProps & {mapIndex?: number; isSplit?: boolean},
  ) => {
    if (props.isSplit) {
      return <SplitPaneLegend {...props} />;
    }

    return (
      <>
        <style>{`.draggable-legend .map-control__panel-header { display: none !important; }`}</style>
        <OriginalMapLegendPanel {...props} />
      </>
    );
  };

  CustomMapLegendPanel.displayName = 'CustomMapLegendPanel';
  return CustomMapLegendPanel;
}
