import {useEffect, useState} from 'react';
import {Coordinator, Selection} from '@uwdata/mosaic-core';
import {createDataFusion, type DataFusion} from '../lab/datafusion';
import {streamTimeCube, type TimeCube} from '../lab/zarr-cube';

export type Lab = {
  cube: TimeCube;
  df: DataFusion;
  coordinator: Coordinator;
  selection: Selection;
};

export type LabBoot =
  | {phase: 'loading'; message: string}
  | {phase: 'error'; message: string}
  | {phase: 'ready'; lab: Lab};

export type LabState = {
  boot: LabBoot;
  /**
   * Incremented after each streamed chunk is folded into the DataFusion
   * tables; consumers (map textures, selection readouts) resync on change.
   */
  cubeVersion: number;
  progress: {loadedChunks: number; totalChunks: number};
  /** False only after the final DataFusion refresh has incorporated the stream. */
  streaming: boolean;
};

/**
 * Boots the client-side stack progressively: streams the ECMWF cube from
 * the public Zarr store chunk by chunk, materializes the DataFusion-WASM
 * tables as soon as the first chunk lands, then wires a Mosaic coordinator
 * with a crossfilter selection shared by every interactor. Each later chunk
 * re-registers the tables and requeries the Mosaic clients so the charts
 * fill in as the data streams.
 */
export function useForecastLab(): LabState {
  const [boot, setBoot] = useState<LabBoot>({
    phase: 'loading',
    message: 'Fetching ECMWF Zarr metadata',
  });
  const [cubeVersion, setCubeVersion] = useState(0);
  const [progress, setProgress] = useState({loadedChunks: 0, totalChunks: 0});
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let lab: Lab | null = null;
    let loaded: Uint8Array | null = null;
    let refreshRunning = false;
    let refreshPending = false;
    let streamComplete = false;
    let streamError: unknown = null;

    const disposeLab = () => {
      const currentLab = lab;
      lab = null;
      loaded = null;
      if (!currentLab) return;
      currentLab.coordinator.clear();
      void currentLab.df.dispose();
    };

    const fail = (label: string, error: unknown) => {
      console.error(label, error);
      if (cancelled) return;
      setStreaming(false);
      setBoot({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      disposeLab();
    };

    /**
     * Coalesces chunk arrivals: while a refresh is in flight further chunks
     * only mark it pending, and one more pass picks up everything they
     * wrote into the shared cube and mask.
     */
    const scheduleRefresh = () => {
      refreshPending = true;
      if (!lab || !loaded || refreshRunning || cancelled) return;
      refreshRunning = true;
      void (async () => {
        try {
          while (refreshPending && !cancelled) {
            refreshPending = false;
            await lab!.df.refreshData(loaded!);
            if (cancelled) return;
            lab!.coordinator.clients.forEach((client) => {
              if (client.enabled) void client.requestQuery();
            });
            setCubeVersion((version) => version + 1);
          }
          if (streamComplete && !refreshPending) setStreaming(false);
        } catch (error) {
          fail('DataFusion cube refresh failed', error);
        } finally {
          refreshRunning = false;
        }
      })();
    };

    (async () => {
      let signalFirstChunk = () => {};
      const firstChunk = new Promise<void>((resolve) => {
        signalFirstChunk = resolve;
      });
      const stream = await streamTimeCube((loadedChunks, totalChunks) => {
        if (cancelled) return;
        setProgress({loadedChunks, totalChunks});
        signalFirstChunk();
        scheduleRefresh();
      });
      if (cancelled) return;
      setBoot({phase: 'loading', message: 'Fetching ECMWF Zarr chunks'});
      void stream.done.then(
        () => {
          if (cancelled) return;
          streamComplete = true;
          scheduleRefresh();
        },
        (error: unknown) => {
          streamError = error;
          signalFirstChunk();
          if (lab) fail('ECMWF chunk streaming failed', error);
        },
      );
      await firstChunk;
      if (cancelled) return;
      if (streamError) throw streamError;
      setBoot({
        phase: 'loading',
        message: 'Materializing DataFusion-WASM tables',
      });
      const df = await createDataFusion(stream.cube, stream.loaded, () => {});
      if (cancelled || streamError) {
        void df.dispose();
        if (streamError) throw streamError;
        return;
      }
      const coordinator = new Coordinator(df as never, {
        cache: false,
        consolidate: true,
        preagg: {enabled: false},
      });
      const selection = Selection.crossfilter();
      lab = {cube: stream.cube, df, coordinator, selection};
      loaded = stream.loaded;
      setBoot({phase: 'ready', lab});
      scheduleRefresh();
    })().catch((error: unknown) => {
      fail('Forecast lab initialization failed', error);
    });
    return () => {
      cancelled = true;
      disposeLab();
    };
  }, []);

  return {boot, cubeVersion, progress, streaming};
}
