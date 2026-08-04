import {useMemo} from 'react';
import {ForecastProvider} from './ForecastContext';
import {useForecastLab, type Lab} from './hooks/use-forecast-lab';
import {Room} from './room';
import {createForecastRoomStore} from './store';

/**
 * The Coordinator needed by createMosaicSlice can only be built once the
 * DataFusion-WASM tables exist, which needs at least the first streamed
 * Zarr chunk, so the room store is created here (after that boot phase)
 * rather than as a static module export the way other examples do it.
 */
export function App() {
  const {boot, cubeVersion, progress} = useForecastLab();

  if (boot.phase === 'error') {
    return (
      <div className="text-destructive flex h-screen w-screen items-center justify-center p-8 text-sm">
        {boot.message}
      </div>
    );
  }

  if (boot.phase !== 'ready') {
    return (
      <div className="text-muted-foreground flex h-screen w-screen items-center justify-center gap-3 text-sm">
        <span className="spinner" aria-hidden="true" />
        {boot.message}
      </div>
    );
  }

  return (
    <ReadyApp lab={boot.lab} cubeVersion={cubeVersion} progress={progress} />
  );
}

function ReadyApp({
  lab,
  cubeVersion,
  progress,
}: {
  lab: Lab;
  cubeVersion: number;
  progress: {loadedChunks: number; totalChunks: number};
}) {
  const {roomStore} = useMemo(() => createForecastRoomStore(lab), [lab]);

  return (
    <ForecastProvider lab={lab} cubeVersion={cubeVersion} progress={progress}>
      <Room roomStore={roomStore} />
    </ForecastProvider>
  );
}
