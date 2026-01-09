import {
  MapLegendPanelFactory,
  MapLegendPanelFactoryDeps,
  MapLegendPanelProps,
} from '@kepler.gl/components';

CustomMapLegendPanelFactory.deps = MapLegendPanelFactory.deps;

export function CustomMapLegendPanelFactory(
  ...deps: MapLegendPanelFactoryDeps
): ReturnType<typeof MapLegendPanelFactory> {
  // @ts-ignore
  const MapLegendPanel = MapLegendPanelFactory(...deps);
  return (props: MapLegendPanelProps) => {
    return (
      <>
        <style>{`.draggable-legend .map-control__panel-header { display: none !important; }`}</style>
        <MapLegendPanel {...props} />
      </>
    );
  };
}
