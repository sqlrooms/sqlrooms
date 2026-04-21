import {RoomShell} from '@sqlrooms/room-shell';
import {PanelBottomCloseIcon, PanelBottomOpenIcon} from 'lucide-react';
import {useRoomStore} from '../store';
import {FC} from 'react';

export const CollapseBottomButton: FC = () => {
  const isCollapsed = useRoomStore((s) => s.layout.isCollapsed('bottom'));
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const Icon = isCollapsed ? PanelBottomOpenIcon : PanelBottomCloseIcon;

  return (
    <RoomShell.SidebarButton
      title={isCollapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
      icon={Icon}
      isSelected={!isCollapsed}
      onClick={() => toggleCollapsed('bottom')}
    />
  );
};
