import * as React from 'react';
import {cn} from '../lib/utils';
import {Skeleton} from './skeleton';

export type SkeletonPaneProps = {
  n?: number;
  staggeringDelay?: number;
  rowHeight?: number | string;
  className?: string;
};

const SkeletonPane: React.FC<SkeletonPaneProps> = ({
  n = 3,
  staggeringDelay = 200,
  rowHeight = '20px',
  className,
}) => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (count >= n) return;

    const timer = setTimeout(() => {
      setCount(count + 1);
    }, staggeringDelay);

    return () => clearTimeout(timer);
  }, [count, n, staggeringDelay]);

  return (
    <div className={cn('flex w-full flex-col justify-center', className)}>
      <div className="flex flex-col gap-2">
        {Array.from({length: n}).map((_, i) =>
          i < count ? (
            <Skeleton key={i} className="w-full" style={{height: rowHeight}} />
          ) : (
            <div key={i} style={{height: rowHeight}} />
          ),
        )}
      </div>
    </div>
  );
};

export {SkeletonPane};
