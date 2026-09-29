import type {ComponentPropsWithoutRef, FC, ReactNode} from 'react';
import {cn} from '@sqlrooms/ui';

/** Props for {@link BlockHeader}. */
export type BlockHeaderProps = ComponentPropsWithoutRef<'div'> & {
  /** The caption element, normally a `BlockCaptionEditor`. */
  children: ReactNode;
  /** Optional actions rendered at the trailing edge of the header. */
  actions?: ReactNode;
  /** Additional classes for the actions row, e.g. a wider gap. */
  actionsClassName?: string;
};

/**
 * Shared chrome for a document block header: caption on the leading edge,
 * actions on the trailing edge. Pair it with `BlockCaptionEditor`. Keeping the
 * container here stops chart, map, table and dashboard headers from drifting
 * apart.
 */
export const BlockHeader: FC<BlockHeaderProps> = ({
  children,
  actions,
  actionsClassName,
  className,
  ...rest
}) => {
  return (
    <div
      className={cn(
        'border-border flex min-h-10 shrink-0 items-center gap-2 border-b px-3 py-2',
        className,
      )}
      {...rest}
    >
      {children}
      {actions ? (
        <div
          className={cn('flex shrink-0 items-center gap-0.5', actionsClassName)}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
};
