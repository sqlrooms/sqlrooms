import {type FC} from 'react';
import {useHoverBrush} from '../hooks/use-hover-brush';
import {useRoomStore} from '../store';
import {MapPane, MapShell} from './MapPane';

export const MainView: FC = () => {
  const {lab, setMap} = useRoomStore((state) => state.forecast);
  const brush = useHoverBrush();

  return (
    <div className="relative h-full w-full">
      <MapPane cube={lab.cube.temperature} brush={brush} onMap={setMap} />
    </div>
  );
};

export {MapShell};
