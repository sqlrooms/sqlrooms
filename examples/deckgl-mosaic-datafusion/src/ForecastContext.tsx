import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import type {Lab} from './hooks/use-forecast-lab';
import {
  useForecastSession,
  type ForecastSession,
} from './hooks/use-forecast-session';
import {useHoverBrush, type HoverBrush} from './hooks/use-hover-brush';
import type {MapView} from './lab/map-view';

/**
 * MapPane (main panel) and ForecastPanel (left tab) both need the imperative
 * MapView instance, the crossfilter session, and the hover brush, but they
 * live in different RoomShell layout panels rather than nesting like the
 * original app's single-column JSX. A context takes the place of that
 * parent/child prop passing.
 */
type ForecastContextValue = {
  lab: Lab;
  map: MapView | null;
  setMap: (map: MapView | null) => void;
  session: ForecastSession;
  brush: HoverBrush;
  streaming: boolean;
};

const ForecastContext = createContext<ForecastContextValue | null>(null);

export const ForecastProvider: FC<{
  lab: Lab;
  cubeVersion: number;
  progress: {loadedChunks: number; totalChunks: number};
  children: ReactNode;
}> = ({lab, cubeVersion, progress, children}) => {
  const [map, setMap] = useState<MapView | null>(null);
  const session = useForecastSession(lab, map, cubeVersion);
  const brush = useHoverBrush(lab.selection, map);
  const streaming = progress.loadedChunks < progress.totalChunks;

  useEffect(() => {
    if (cubeVersion > 0) map?.refreshCube();
  }, [map, cubeVersion]);

  return (
    <ForecastContext.Provider
      value={{lab, map, setMap, session, brush, streaming}}
    >
      {children}
    </ForecastContext.Provider>
  );
};

export function useForecast() {
  const value = useContext(ForecastContext);
  if (!value)
    throw new Error('useForecast must be used within a ForecastProvider');
  return value;
}
