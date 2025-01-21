import React from 'react';
import {cn} from '../lib/utils';
import {Spinner} from './spinner';

export type SpinnerPaneProps = {
  h?: number | string;
  delayed?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const DELAY = 500;

const SpinnerPane: React.FC<SpinnerPaneProps> = (props) => {
  const {h, delayed, children, className, ...rest} = props;
  const [isPlaying, setPlaying] = React.useState(!delayed);

  React.useEffect(() => {
    if (!isPlaying && delayed) {
      const timer = setTimeout(() => setPlaying(true), DELAY);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, delayed]);

  return (
    <div
      className={cn(
        'mx-auto flex min-h-[inherit] items-center justify-center',
        className,
      )}
      style={{minHeight: h}}
      {...rest}
    >
      {isPlaying ? (
        <div className="flex flex-col items-center gap-2">
          {children}
          <Spinner className="text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
};

export {SpinnerPane};
