import {type FC} from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={!canAddAnyPanel}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <DropdownMenuItem
              key={action.type}
              onClick={() => handleAddPanel(action)}
              disabled={!canAddPanel(action)}
            >
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
