import {
  MapLegendPanelFactory,
  MapLegendPanelProps,
} from '@kepler.gl/components';

CustomMapLegendPanelFactory.deps = MapLegendPanelFactory.deps;

export function CustomMapLegendPanelFactory(
  ...deps: Parameters<typeof MapLegendPanelFactory>
): ReturnType<typeof MapLegendPanelFactory> {
  const MapLegendPanel = MapLegendPanelFactory(...deps);
  const CustomMapLegendPanel = (props: MapLegendPanelProps) => {
    return (
      <>
        <style>{`.draggable-legend .map-control__panel-header { display: none !important; }`}</style>
        <MapLegendPanel {...props} />
      </>
    );
  };
  CustomMapLegendPanel.displayName = 'CustomMapLegendPanel';
  return CustomMapLegendPanel;
}
