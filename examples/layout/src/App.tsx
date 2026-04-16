import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {PanelBottomCloseIcon, PanelBottomOpenIcon} from 'lucide-react';
import {roomStore, useRoomStore} from './store';
import {FC} from 'react';

const CollapseBottomButton: FC = () => {
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

export const App: FC = () => {
  const addDashboard = useRoomStore((s) => s.addDashboard);

  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.SidebarContainer>
          <RoomShell.TabButtons />
          <div className="flex-1" />
          <CollapseBottomButton />
          <RoomShell.CommandPalette.Button />
          <ThemeSwitch />
        </RoomShell.SidebarContainer>
        <RoomShell.LayoutComposer onTabCreate={addDashboard} />
        <RoomShell.CommandPalette />
      </RoomShell>
    </ThemeProvider>
  );
};
