import {Button} from '@sqlrooms/ui';
import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import React from 'react';

export interface CollapsibleSectionButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * A simple collapse/expand button with chevron icon for collapsible sections
 */
export const CollapsibleSectionButton: React.FC<
  CollapsibleSectionButtonProps
> = ({isCollapsed, onToggle}) => {
  return (
    <Button
      size="xs"
      variant="ghost"
      className="absolute top-1 left-1 z-20 h-4 w-4 p-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-50 focus-visible:opacity-100"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
    >
      {isCollapsed ? (
        <ChevronRightIcon className="h-3 w-3" />
      ) : (
        <ChevronDownIcon className="h-3 w-3" />
      )}
    </Button>
  );
};
