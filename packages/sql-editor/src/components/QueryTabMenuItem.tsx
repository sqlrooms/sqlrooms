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
      className="flex h-7 cursor-pointer items-center justify-between truncate"
    >
      <span className="xs truncate pl-1">{tab.name}</span>
      <div className="flex items-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground h-3 w-3"
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
          className="text-muted-foreground h-3 w-3"
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
