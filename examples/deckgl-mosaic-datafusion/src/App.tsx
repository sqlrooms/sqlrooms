import {useEffect, useMemo} from 'react';
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
  const {boot, cubeVersion, streaming} = useForecastLab();

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
    <ReadyApp lab={boot.lab} cubeVersion={cubeVersion} streaming={streaming} />
  );
}

function ReadyApp({
  lab,
  cubeVersion,
  streaming,
}: {
  lab: Lab;
  cubeVersion: number;
  streaming: boolean;
}) {
  const {roomStore} = useMemo(() => createForecastRoomStore(lab), [lab]);

  useEffect(() => {
    return () => roomStore.getState().forecast.dispose();
  }, [roomStore]);

  useEffect(() => {
    if (cubeVersion > 0) roomStore.getState().forecast.refreshCube();
  }, [roomStore, cubeVersion]);

  useEffect(() => {
    roomStore.getState().forecast.setStreaming(streaming);
  }, [roomStore, streaming]);

  return <Room roomStore={roomStore} />;
}
