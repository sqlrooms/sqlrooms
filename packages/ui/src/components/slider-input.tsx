'use client';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {PencilIcon, SlidersHorizontalIcon} from 'lucide-react';
import * as React from 'react';
import {cn} from '../lib/utils';
import {Slider} from './slider';

/** Decimal places implied by a step, e.g. `0.01` -> `2`, `1e-3` -> `3`. */
function getStepDecimals(step: number): number {
  if (!Number.isFinite(step) || Number.isInteger(step)) return 0;
  const text = String(step);
  const exponentIndex = text.indexOf('e-');
  if (exponentIndex >= 0) return Number(text.slice(exponentIndex + 2));
  const dotIndex = text.indexOf('.');
  return dotIndex < 0 ? 0 : text.length - dotIndex - 1;
}

/** Round for display without introducing floating point noise. */
function formatValue(value: number, step: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Number(value.toFixed(getStepDecimals(step))));
}

/**
 * Clamp to `[min, max]` and snap onto the step grid, matching how the slider
 * itself would quantize a dragged value.
 */
function snapToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const clamped = Math.min(Math.max(value, min), max);
  if (!(step > 0)) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(
    Math.min(Math.max(snapped, min), max).toFixed(getStepDecimals(step)),
  );
}

export interface SliderInputProps extends Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'value' | 'defaultValue' | 'onValueChange' | 'onValueCommit'
> {
  /** Current value. */
  value: number;
  /**
   * Called with the clamped, step-aligned value, whether it came from dragging
   * the slider or from the manual input.
   */
  onValueChange: (value: number) => void;
}

/**
 * Single-value slider with a toggle that swaps the track for a numeric input,
 * so values that are hard to hit by dragging can be typed exactly.
 *
 * The toggle is only visible on hover or keyboard focus to keep dense settings
 * panels uncluttered. Typed values are clamped to `[min, max]` and snapped to
 * `step`, so the input never produces a value the slider could not represent.
 *
 * @example
 * ```tsx
 * <SliderInput
 *   min={0.01}
 *   max={1000}
 *   step={0.01}
 *   value={elevationScale}
 *   onValueChange={setElevationScale}
 *   aria-label="Elevation scale"
 * />
 * ```
 */
export const SliderInput = React.forwardRef<HTMLDivElement, SliderInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      ...props
    },
    ref,
  ) => {
    // `null` means the slider is shown; a string means the input is shown.
    const [draft, setDraft] = React.useState<string | null>(null);
    const isEditing = draft !== null;

    const commit = () => {
      const parsed = Number(draft);
      if (draft?.trim() && Number.isFinite(parsed)) {
        const next = snapToStep(parsed, min, max, step);
        if (next !== value) onValueChange(next);
      }
      setDraft(null);
    };

    return (
      <div
        ref={ref}
        className={cn(
          // `min-h-6` matches the input so toggling modes does not shift the
          // rows below it.
          'group/slider-input flex min-h-6 w-full items-center gap-1',
          className,
        )}
      >
        {isEditing ? (
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft}
            disabled={disabled}
            aria-label={props['aria-label']}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(null);
              }
            }}
            className={cn(
              'border-input focus-visible:ring-ring h-6 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-xs tabular-nums shadow-xs',
              'focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
              '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            )}
          />
        ) : (
          <Slider
            className="min-w-0 flex-1"
            min={min}
            max={max}
            step={step}
            value={[value]}
            disabled={disabled}
            onValueChange={(values) => {
              const next = values[0];
              if (next !== undefined) onValueChange(next);
            }}
            {...props}
          />
        )}
        <button
          type="button"
          disabled={disabled}
          title={isEditing ? 'Use slider' : 'Enter value'}
          aria-label={isEditing ? 'Use slider' : 'Enter value'}
          // Keep focus on the input so the toggle click is not preceded by a
          // blur that would exit editing before onClick runs.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            isEditing ? commit() : setDraft(formatValue(value, step))
          }
          className={cn(
            'text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 transition-opacity',
            'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-hidden',
            'opacity-0 group-hover/slider-input:opacity-100 focus-visible:opacity-100',
            isEditing && 'opacity-100',
            disabled && 'pointer-events-none opacity-0',
          )}
        >
          {isEditing ? (
            <SlidersHorizontalIcon className="h-3.5 w-3.5" />
          ) : (
            <PencilIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  },
);
SliderInput.displayName = 'SliderInput';
