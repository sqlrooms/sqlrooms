import {
  BarChart3Icon,
  BoxesIcon,
  EyeIcon,
  MapIcon,
  TableIcon,
} from 'lucide-react';
import type {FC} from 'react';
import type {ContextSelectorItem} from './types';
import {useContextSelectorContext} from './ContextSelectorContext';

type ContextSelectorItemIconProps = {
  item: ContextSelectorItem;
  className?: string;
};

export const ContextSelectorItemIcon: FC<ContextSelectorItemIconProps> = ({
  item,
  className = 'h-3.5 w-3.5',
}) => {
  const {renderIcon} = useContextSelectorContext();

  if (renderIcon) {
    return <>{renderIcon(item)}</>;
  }

  if (item.kind === 'table') {
    if (item.type === 'view') {
      return <EyeIcon className={className} />;
    }
    return <TableIcon className={className} />;
  }

  if (item.kind === 'artifact' && item.type === 'map') {
    return <MapIcon className={className} />;
  }

  if (item.kind === 'artifact' && item.type === 'dashboard') {
    return <BarChart3Icon className={className} />;
  }

  return <BoxesIcon className={className} />;
};
