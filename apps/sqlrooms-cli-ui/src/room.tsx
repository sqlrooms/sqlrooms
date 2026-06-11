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
          <CliWorkspaceSidebar onToggleSqlEditor={sqlEditor.onToggle} />
          <SidebarInset className="h-svh min-w-0 overflow-hidden">
            <CliWorkspaceTopbar />
            <RoomShell.LayoutComposer className="min-h-0 flex-1 overflow-hidden [&_[data-slot=resizable-handle][aria-controls=assistant-sidebar][aria-valuenow='0']]:hidden" />
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
