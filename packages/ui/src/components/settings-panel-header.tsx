import type {FC, ReactNode} from 'react';
import {SlidersVerticalIcon, XIcon} from 'lucide-react';
import {cn} from '../lib/utils';
import {Button} from './button';

export type SettingsPanelHeaderProps = {
  /** Header title. Defaults to "Settings". */
  title?: ReactNode;
  /** Optional actions rendered before the close button. */
  actions?: ReactNode;
  /** Optional close action for collapsible settings shells. */
  onClose?: () => void;
  /** Accessible label for the close button. */
  closeLabel?: string;
  /** Additional classes for the header container. */
  className?: string;
};

/** Compact settings panel header with the shared settings icon and close affordance. */
export const SettingsPanelHeader: FC<SettingsPanelHeaderProps> = ({
  title = 'Settings',
  actions,
  onClose,
  closeLabel = 'Close settings panel',
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <SlidersVerticalIcon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </h3>
      {actions || onClose ? (
        <div className="flex items-center gap-1">
          {actions}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
