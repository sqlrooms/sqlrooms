import {cn} from '@sqlrooms/ui';
import type {Components} from 'react-markdown';

export const markdownTableComponent: Components['table'] = ({
  className,
  node: _node,
  ...props
}) => (
  <div className="max-w-full overflow-x-auto">
    <table className={cn('w-max min-w-full', className)} {...props} />
  </div>
);
