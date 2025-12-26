'use client';

import {Flashlight, MousePointer2, Info} from 'lucide-react';
import {Skeleton} from '@/components/charts/EarthquakeCharts';

interface MapControlsProps {
  dbReady: boolean;
  enableBrushing: boolean;
  setEnableBrushing: (v: boolean) => void;
  syncCharts: boolean;
  toggleSyncCharts: () => void;
  brushRadius: number;
  setBrushRadius: (v: number) => void;
  clearBrush: () => void;
  onShowInfo: () => void;
}

export function MapControls({
  dbReady,
  enableBrushing,
  setEnableBrushing,
  brushRadius,
  setBrushRadius,
  clearBrush,
  onShowInfo,
}: MapControlsProps) {
  return (
    <div className="absolute right-4 top-4 z-50 flex w-64 flex-col gap-4 rounded-sm border-slate-700 bg-[#1f1d1b]/90 p-2 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2">
        {!dbReady && (
          <>
            <Skeleton h={35} />
            <Skeleton h={35} />
          </>
        )}

        {dbReady && (
          <>
            <button
              onClick={clearBrush}
              className={`flex flex-1 items-center justify-center gap-2 rounded p-2 ${
                !enableBrushing
                  ? 'bg-[#e67f5f] text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MousePointer2 size={16} />
              <span className="text-xs font-medium">View</span>
            </button>

            <button
              onClick={() => setEnableBrushing(true)}
              className={`flex flex-1 items-center justify-center gap-2 rounded p-2 ${
                enableBrushing
                  ? 'bg-[#e67f5f] text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Flashlight size={16} />
              <span className="text-xs font-medium">Brush</span>
            </button>

            <button
              onClick={onShowInfo}
              className="rounded p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Info size={16} />
            </button>
          </>
        )}
      </div>

      {enableBrushing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Radius</span>
            <span>{(brushRadius / 1000).toFixed(0)} km</span>
          </div>
          <input
            type="range"
            min="5000"
            max="300000"
            step="5000"
            value={brushRadius}
            onChange={(e) => setBrushRadius(Number(e.target.value))}
            className="h-1 w-full cursor-pointer rounded-sm bg-slate-700 accent-[#e67f5f]"
          />
        </div>
      )}
    </div>
  );
}
