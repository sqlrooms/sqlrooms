import {useSidebar} from '@sqlrooms/ui';

export function CliSidebarBrand() {
  const {setOpen} = useSidebar();

  return (
    <button
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md bg-transparent p-1 text-left group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open sidebar"
    >
      <img
        className="size-10 shrink-0 object-contain group-data-[collapsible=icon]:size-7"
        src="/logo.svg"
        alt=""
      />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <div className="truncate text-xl leading-none font-bold">SQLRooms</div>
        <div className="text-muted-foreground truncate text-sm leading-tight">
          Analytics workspace
        </div>
      </div>
    </button>
  );
}
