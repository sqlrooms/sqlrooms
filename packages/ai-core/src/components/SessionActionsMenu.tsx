import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {MoreVertical, PencilIcon, SparklesIcon, TrashIcon} from 'lucide-react';
import {useStoreWithAi} from '../AiSlice';

type SessionActionsMenuProps = {
  onRename?: () => void;
  onDelete: () => void;
};

export const SessionActionsMenu: React.FC<SessionActionsMenuProps> = ({
  onRename,
  onDelete,
}) => {
  const simpleMode = useStoreWithAi((s) => s.ai.simpleMode);
  const setSimpleMode = useStoreWithAi((s) => s.ai.setSimpleMode);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Open session actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Session actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={simpleMode}
          onCheckedChange={(checked) => setSimpleMode(!!checked)}
          onSelect={(e) => e.preventDefault()}
        >
          <SparklesIcon className="mr-2 h-4 w-4" />
          Simple mode
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {onRename ? (
          <>
            <DropdownMenuItem onClick={onRename}>
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
