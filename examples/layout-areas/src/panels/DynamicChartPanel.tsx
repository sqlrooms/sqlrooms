import {useMemo} from 'react';
import {BarChart3Icon} from 'lucide-react';

function generateRandomData(count: number) {
  return Array.from({length: count}, () => Math.round(Math.random() * 90 + 10));
}

const COLORS = [
  'bg-blue-500/70',
  'bg-emerald-500/70',
  'bg-amber-500/70',
  'bg-rose-500/70',
  'bg-violet-500/70',
  'bg-cyan-500/70',
  'bg-pink-500/70',
  'bg-indigo-500/70',
];

export function DynamicChartPanel({label}: {label: string}) {
  const data = useMemo(() => generateRandomData(12), []);
  const colorClass = useMemo(
    () => COLORS[Math.abs(hashCode(label)) % COLORS.length],
    [label],
  );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3Icon className="h-4 w-4" />
        {label}
      </div>
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
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
