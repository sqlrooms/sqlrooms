import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {
  BarChart3Icon,
  PanelBottomCloseIcon,
  PanelBottomOpenIcon,
} from 'lucide-react';
import {useCallback, useRef} from 'react';
import {roomStore, useRoomStore} from './store';
import {DynamicChartPanel} from './panels/DynamicChartPanel';

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

function LayoutWithCreate() {
  const registerPanel = useRoomStore((s) => s.layout.registerPanel);
  const addPanelToArea = useRoomStore((s) => s.layout.addPanelToArea);
  const counterRef = useRef(0);

  const handleTabCreate = useCallback(
    (areaId: string) => {
      counterRef.current += 1;
      const n = counterRef.current;
      const panelId = `chart-${n}`;
      const label = `Chart ${n}`;

      registerPanel(panelId, {
        title: label,
        icon: BarChart3Icon,
        component: () => <DynamicChartPanel label={label} />,
        area: areaId,
      });
      addPanelToArea(areaId, panelId);
    },
    [registerPanel, addPanelToArea],
  );

  return <RoomShell.LayoutComposer onTabCreate={handleTabCreate} />;
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
        <LayoutWithCreate />
        <RoomShell.CommandPalette />
      </RoomShell>
    </ThemeProvider>
  );
};
