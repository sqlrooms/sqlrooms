import type {LegendTick} from './utils';

function getTickTransform(offset: number) {
  if (offset <= 0) {
    return 'none';
  }

  if (offset >= 100) {
    return 'translateX(-100%)';
  }

  return 'translateX(-50%)';
}

function estimateTickLabelWidth(label: string) {
  return label.length * 5.6 + 8;
}

function getTickBounds(tick: LegendTick, width: number) {
  const x = (tick.offset / 100) * width;
  const labelWidth = estimateTickLabelWidth(tick.label);

  if (tick.offset <= 0) {
    return [x, x + labelWidth] as const;
  }

  if (tick.offset >= 100) {
    return [x - labelWidth, x] as const;
  }

  return [x - labelWidth / 2, x + labelWidth / 2] as const;
}

function getVisibleTicks(ticks: LegendTick[], width: number) {
  const sortedTicks = [...ticks].sort(
    (left, right) => left.offset - right.offset,
  );
  const visibleTicks: LegendTick[] = [];
  let lastEnd = -Infinity;

  for (const tick of sortedTicks) {
    const [start, end] = getTickBounds(tick, width);
    if (start >= lastEnd + 6) {
      visibleTicks.push(tick);
      lastEnd = end;
    }
  }

  return visibleTicks;
}

export function LegendTicks({
  ticks,
  width,
}: {
  ticks: LegendTick[];
  width: number;
}) {
  return (
    <div className="relative h-8">
      {getVisibleTicks(ticks, width).map((tick) => (
        <div
          key={`${tick.offset}-${tick.label}`}
          className="absolute top-0 flex flex-col items-center"
          style={{
            left: `${tick.offset}%`,
            transform: getTickTransform(tick.offset),
          }}
        >
          <span className="border-border h-1.5 border-l" />
          <span className="text-muted-foreground mt-1 text-[10px] leading-none whitespace-nowrap tabular-nums">
            {tick.label}
          </span>
        </div>
      ))}
    </div>
  );
}
