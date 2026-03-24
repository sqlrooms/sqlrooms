import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {PanelBottomCloseIcon, PanelBottomOpenIcon} from 'lucide-react';
import {roomStore, useRoomStore} from './store';

function CollapseBottomButton() {
  const isCollapsed = useRoomStore((s) => s.layout.isAreaCollapsed('bottom'));
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleAreaCollapsed);
  const Icon = isCollapsed ? PanelBottomOpenIcon : PanelBottomCloseIcon;
  return (
    <RoomShell.SidebarButton
      title={isCollapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
      icon={Icon}
      isSelected={!isCollapsed}
      onClick={() => toggleCollapsed('bottom')}
    />
  );
}

export const App = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.SidebarContainer>
          <RoomShell.AreaPanelButtons area="left" />
          <div className="flex-1" />
          <CollapseBottomButton />
          <RoomShell.CommandPalette.Button />
          <ThemeSwitch />
        </RoomShell.SidebarContainer>
        <RoomShell.LayoutComposer />
        <RoomShell.CommandPalette />
      </RoomShell>
    </ThemeProvider>
  );
};
