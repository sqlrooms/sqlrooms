import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {
  SidebarInset,
  SidebarProvider,
  ThemeProvider,
  useDisclosure,
} from '@sqlrooms/ui';
import {
  CliWorkspaceSidebar,
  CliWorkspaceTopbar,
} from './components/CliWorkspaceSidebar';
import {roomStore} from './store';

export const Room = () => {
  const sqlEditor = useDisclosure();
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-cli-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <SidebarProvider defaultOpen>
          <CliWorkspaceSidebar />
          <SidebarInset className="min-w-0">
            <CliWorkspaceTopbar onToggleSqlEditor={sqlEditor.onToggle} />
            <RoomShell.LayoutComposer />
            <RoomShell.LoadingProgress />
            <RoomShell.CommandPalette />
            <SqlEditorModal
              isOpen={sqlEditor.isOpen}
              onClose={sqlEditor.onClose}
            />
          </SidebarInset>
        </SidebarProvider>
      </RoomShell>
    </ThemeProvider>
  );
};
