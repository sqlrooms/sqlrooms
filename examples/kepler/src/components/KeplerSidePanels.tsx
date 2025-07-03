import {KeplerSidePanels} from '@sqlrooms/kepler';
import {RoomPanel} from '@sqlrooms/room-shell';
import {RoomPanelTypes, useRoomStore} from '../store';

export function KeplerSidePanelLayerManager() {
  const currentMap = useRoomStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <RoomPanel type={RoomPanelTypes.enum['kepler-layers']}>
      <KeplerSidePanels panelId="layer" mapId={currentMap?.id || ''} />
    </RoomPanel>
  );
}

export function KeplerSidePanelFilterManager() {
  const currentMap = useRoomStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <RoomPanel type={RoomPanelTypes.enum['kepler-filters']}>
      <KeplerSidePanels panelId="filter" mapId={currentMap?.id || ''} />
    </RoomPanel>
  );
}

export function KeplerSidePanelBaseMapManager() {
  const currentMap = useRoomStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <RoomPanel type={RoomPanelTypes.enum['kepler-basemaps']}>
      <KeplerSidePanels panelId="map" mapId={currentMap?.id || ''} />
    </RoomPanel>
  );
}

export function KeplerSidePanelInteractionManager() {
  const currentMap = useRoomStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <RoomPanel type={RoomPanelTypes.enum['kepler-interactions']}>
      <KeplerSidePanels panelId="interaction" mapId={currentMap?.id || ''} />
    </RoomPanel>
  );
}
