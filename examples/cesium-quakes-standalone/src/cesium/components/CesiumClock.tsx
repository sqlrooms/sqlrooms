/**
 * Clock control component for time-dynamic Cesium visualizations.
 */

import React, {useCallback} from 'react';
import {Play, Pause} from 'lucide-react';
import {Button, Slider, Label} from '@sqlrooms/ui';
import {useStoreWithCesium} from '../cesium-slice';
import {cn} from '@sqlrooms/ui';

export interface CesiumClockProps {
  className?: string;
}

// Predefined speed steps mapped to slider positions (0–100)
// Provides logarithmic feel: 1x → 1hr/s → 1day/s → 1week/s → 1month/s → 1year/s
const SPEED_STEPS = [
  {value: 1, label: '1x'},
  {value: 60, label: '1min/s'},
  {value: 3600, label: '1hr/s'},
  {value: 86400, label: '1day/s'},
  {value: 604800, label: '1wk/s'},
  {value: 2592000, label: '1mo/s'},
  {value: 31536000, label: '1yr/s'},
];

/** Convert a multiplier value to the nearest slider position (0–6). */
function multiplierToSlider(multiplier: number): number {
  let closest = 0;
  let minDiff = Infinity;
  for (let i = 0; i < SPEED_STEPS.length; i++) {
    const step = SPEED_STEPS[i]!;
    const diff = Math.abs(Math.log(multiplier) - Math.log(step.value));
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
}

/** Get a human-readable label for the current multiplier. */
function getSpeedLabel(multiplier: number): string {
  return SPEED_STEPS[multiplierToSlider(multiplier)]!.label;
}

/**
 * Clock controls for animation playback and speed adjustment.
 * Provides play/pause and speed multiplier slider.
 *
 * @example
 * ```typescript
 * <CesiumClock className="absolute bottom-4 left-4 z-10" />
 * ```
 */
export const CesiumClock: React.FC<CesiumClockProps> = ({className}) => {
  const isAnimating = useStoreWithCesium((s) => s.cesium.isAnimating);
  const multiplier = useStoreWithCesium(
    (s) => s.cesium.config.clock.multiplier,
  );
  const toggleAnimation = useStoreWithCesium((s) => s.cesium.toggleAnimation);
  const setClockConfig = useStoreWithCesium((s) => s.cesium.setClockConfig);

  const handleSpeedChange = useCallback(
    (values: number[]) => {
      const idx = values[0] ?? 0;
      const step = SPEED_STEPS[idx]!;
      setClockConfig({multiplier: step.value});
    },
    [setClockConfig],
  );

  const sliderValue = multiplierToSlider(multiplier);

  return (
    <div
      className={cn(
        'bg-background/80 flex items-center gap-3 rounded-lg p-3 shadow-lg backdrop-blur',
        className,
      )}
    >
      {/* Play/Pause button */}
      <Button
        onClick={toggleAnimation}
        variant="outline"
        size="sm"
        title={isAnimating ? 'Pause animation' : 'Play animation'}
      >
        {isAnimating ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Speed multiplier slider */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Speed:</Label>
        <Slider
          value={[sliderValue]}
          onValueChange={handleSpeedChange}
          min={0}
          max={SPEED_STEPS.length - 1}
          step={1}
          className="w-28"
          title={getSpeedLabel(multiplier)}
        />
        <span className="text-muted-foreground w-12 text-xs">
          {getSpeedLabel(multiplier)}
        </span>
      </div>
    </div>
  );
};
