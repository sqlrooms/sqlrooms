import {type ReactNode} from 'react';

/**
 * The composer's footer row: a horizontally scrolling strip of chips with an
 * action cluster pinned to the end.
 *
 * `actions` is rendered unwrapped so each caller supplies its own container —
 * the composer and the API-key screen space their actions differently.
 */
export function ComposerFooterStrip({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
      <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
