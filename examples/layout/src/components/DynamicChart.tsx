import {FC, useMemo} from 'react';

function generateRandomData(count: number) {
  return Array.from({length: count}, () => Math.round(Math.random() * 90 + 10));
}

const COLORS = [
  'bg-blue-500/70',
  'bg-amber-600/70',
  'bg-emerald-500/70',
  'bg-pink-600/70',
  'bg-orange-500/70',
  'bg-indigo-600/70',
  'bg-lime-500/70',
  'bg-rose-600/70',
  'bg-cyan-500/70',
  'bg-purple-600/70',
  'bg-amber-500/70',
  'bg-teal-600/70',
  'bg-violet-500/70',
  'bg-red-600/70',
  'bg-sky-500/70',
  'bg-fuchsia-600/70',
  'bg-rose-500/70',
  'bg-green-600/70',
  'bg-indigo-500/70',
  'bg-orange-600/70',
  'bg-teal-500/70',
  'bg-blue-600/70',
  'bg-pink-500/70',
  'bg-lime-600/70',
  'bg-purple-500/70',
  'bg-emerald-600/70',
  'bg-fuchsia-500/70',
  'bg-sky-600/70',
  'bg-red-500/70',
  'bg-cyan-600/70',
  'bg-green-500/70',
  'bg-violet-600/70',
];

export type DynamicChartProps = {
  chartId: string;
};

export const DynamicChart: FC<DynamicChartProps> = ({chartId}) => {
  const data = useMemo(() => generateRandomData(12), []);
  const colorClass = useMemo(
    () => COLORS[Math.abs(hashCode(chartId)) % COLORS.length],
    [chartId],
  );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-1 items-end gap-1.5 rounded p-2">
        {data.map((h, i) => (
          <div
            key={i}
            className={`${colorClass} flex-1 rounded-t transition-all`}
            style={{height: `${h}%`}}
          />
        ))}
      </div>
    </div>
  );
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
