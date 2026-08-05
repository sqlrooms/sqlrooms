import type {FC} from 'react';
import {useForecast} from '../ForecastContext';
import {MapPane, MapShell} from './MapPane';

export const MainView: FC = () => {
  const {lab, brush, setMap} = useForecast();
  return (
    <div className="relative h-full w-full">
      <MapPane cube={lab.cube.temperature} brush={brush} onMap={setMap} />
    </div>
  );
};

export {MapShell};
