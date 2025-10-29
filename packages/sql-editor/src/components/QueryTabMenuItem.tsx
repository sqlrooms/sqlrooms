import {Button, DropdownMenuItem} from '@sqlrooms/ui';
import {PencilIcon, TrashIcon} from 'lucide-react';
import React from 'react';

interface QueryTabMenuItemProps {
  tab: {
    id: string;
    name: string;
  };
  onRestore: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export const QueryTabMenuItem: React.FC<QueryTabMenuItemProps> = ({
  tab,
  onRestore,
  onRename,
  onDelete,
}) => {
  return (
    <DropdownMenuItem
      onClick={onRestore}
      className="flex items-center justify-between truncate h-7 cursor-pointer"
    >
      <span className="truncate xs pl-1">{tab.name}</span>
      <div className="flex items-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          className="w-3 h-3 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
        >
          <PencilIcon size={12} className="!size-3" />
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="w-3 h-3 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon size={12} className="!size-3" />
        </Button>
      </div>
    </DropdownMenuItem>
  );
};

