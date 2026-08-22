import {type ReactNode} from 'react';

/**
 * The composer's top row: context selectors on the left, host actions on the
 * right. Renders nothing when both are empty.
 */
export function ComposerTopRow({
  contextSelectors,
  topActions,
}: {
  contextSelectors: ReactNode[];
  topActions?: ReactNode;
}) {
  if (contextSelectors.length === 0 && !topActions) {
    return null;
  }

  return (
    <div className="flex w-full items-start gap-2 px-2 pt-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {contextSelectors}
      </div>
      {topActions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {topActions}
        </div>
      ) : null}
    </div>
  );
}
