import {FC} from 'react';

import {LoaderCircleIcon} from 'lucide-react';
import {cn} from '../lib/utils';

/**
 * Loading spinner component
 */
export const Spinner: FC<{className?: string}> = ({className}) => {
  return (
    <LoaderCircleIcon
      className={cn('animate-spin text-brand-primary', className)}
      size={17}
    />
  );
};
