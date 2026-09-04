import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarRail,
} from '@sqlrooms/ui';
import {CliDataSidebarSection} from './CliDataSidebarSection';
import {CliSidebarBrand} from './CliSidebarBrand';
import {CliSidebarFooterControls} from './CliSidebarFooterControls';
import {CliWorkspaceSidebarTabs} from './CliWorkspaceSidebarTabs';

export function CliWorkspaceSidebar({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar">
      <SidebarHeader className="gap-3 group-data-[collapsible=icon]:py-1.5">
        <CliSidebarBrand />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden group-data-[collapsible=icon]:gap-0">
        <SidebarGroup className="border-sidebar-border min-h-0 flex-1 border-b py-3 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:py-1">
          <SidebarGroupContent className="h-full min-h-0">
            <CliWorkspaceSidebarTabs />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-[0_1_48%] py-3 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:py-1">
          <SidebarGroupContent className="h-full min-h-0">
            <CliDataSidebarSection />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:py-1">
        <CliSidebarFooterControls onToggleSqlEditor={onToggleSqlEditor} />
      </SidebarFooter>
      <SidebarRail className="after:hidden" />
    </Sidebar>
  );
}
