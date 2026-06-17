import {type FC} from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Plus} from 'lucide-react';
import {useAddPanelActions} from '../useAddPanelActions';

interface MosaicDashboardAddPanelDropdownProps {
  dashboardId: string;
}

export const MosaicDashboardAddPanelDropdown: FC<
  MosaicDashboardAddPanelDropdownProps
> = ({dashboardId}) => {
  const {handleAddPanel, canAddPanel, actions, canAddAnyPanel} =
    useAddPanelActions(dashboardId);

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 w-8"
              disabled={!canAddAnyPanel}
              aria-label="Add panel"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Add panel</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <DropdownMenuItem
              key={action.type}
              onClick={() => handleAddPanel(action)}
              disabled={!canAddPanel(action)}
            >
              {Icon ? <Icon className="mr-2 h-3.5 w-3.5" /> : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
