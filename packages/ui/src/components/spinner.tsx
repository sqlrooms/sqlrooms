import {FC} from 'react';

import {LoaderCircleIcon} from 'lucide-react';
import {cn} from '../lib/utils';

/**
 * Loading spinner component
 */
export const Spinner: FC<{className?: string}> = ({className}) => {
  return (
    <LoaderCircleIcon
      className={cn('text-brand-primary animate-spin', className)}
      size={17}
    />
  );
};
