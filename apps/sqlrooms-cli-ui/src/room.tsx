import {RoomShell} from '@sqlrooms/room-shell';
import {DeckMapDefaultStylesProvider} from '@sqlrooms/deck';
import {runtimeConfig} from './runtimeEnvironment';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {
  SidebarInset,
  SidebarProvider,
  ThemeProvider,
  useDisclosure,
} from '@sqlrooms/ui';
import {CliWorkspaceSidebar} from './workspace/sidebar';
import {roomStore} from './store';
import {CliDuckDbConnectionLostDialog} from './components/CliDuckDbConnectionLostDialog';
import {CliMcpBridge} from './components/CliMcpBridge';
import {CliMcpQueryApprovalDialog} from './components/CliMcpQueryApprovalDialog';

export const Room = () => {
  const sqlEditor = useDisclosure();
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-cli-ui-theme">
      <DeckMapDefaultStylesProvider
        protomapsApiKey={runtimeConfig.protomapsApiKey}
      >
        <RoomShell className="h-screen" roomStore={roomStore}>
          <SidebarProvider defaultOpen>
            <CliWorkspaceSidebar onToggleSqlEditor={sqlEditor.onToggle} />
            <SidebarInset className="h-svh min-w-0 overflow-hidden">
              <RoomShell.LayoutComposer className="min-h-0 flex-1 overflow-hidden [&_[data-slot=resizable-handle][aria-controls=assistant-sidebar][aria-valuenow='0']]:hidden" />
              <RoomShell.LoadingProgress />
              <RoomShell.CommandPalette />
              <CliDuckDbConnectionLostDialog />
              <CliMcpBridge />
              <CliMcpQueryApprovalDialog />
              <SqlEditorModal
                isOpen={sqlEditor.isOpen}
                onClose={sqlEditor.onClose}
              />
            </SidebarInset>
          </SidebarProvider>
        </RoomShell>
      </DeckMapDefaultStylesProvider>
    </ThemeProvider>
  );
};
