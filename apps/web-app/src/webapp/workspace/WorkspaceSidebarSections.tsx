import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@sqlrooms/ui';
import {ChevronDown, Database, Eye, Table2, UploadCloud} from 'lucide-react';

export type WorkspaceSchemaTableItem = {
  key: string;
  name: string;
  meta: string;
};

export function DatabaseSidebarSection({
  tables,
  status,
  runtimeStatus,
  onAddFile,
  onPreviewTable,
}: {
  tables: WorkspaceSchemaTableItem[];
  status: string | null;
  runtimeStatus: string;
  onAddFile: () => void;
  onPreviewTable: (tableName: string) => void;
}) {
  const {state} = useSidebar();

  if (state === 'expanded') {
    return (
      <div className="sidebar-inline-panel">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="add-file-button"
              onClick={onAddFile}
              type="button"
            >
              <UploadCloud className="size-4" aria-hidden />
              <span>Add file</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="schema-tree">
          <div className="schema-node">
            <Database className="size-4" aria-hidden />
            <span>main</span>
          </div>
          {tables.map((table) => (
            <button
              className="schema-table"
              key={table.key}
              type="button"
              onClick={() => onPreviewTable(table.name)}
            >
              <Table2 className="size-4" aria-hidden />
              <div className="min-w-0">
                <div className="schema-table-name">{table.name}</div>
                <div className="schema-table-meta">{table.meta}</div>
              </div>
              <Eye className="schema-table-preview-icon size-3.5" aria-hidden />
            </button>
          ))}
          {tables.length === 0 ? (
            <div className="schema-empty">
              {runtimeStatus === 'initializing'
                ? 'Preparing runtime'
                : 'No tables'}
            </div>
          ) : null}
          {status ? <div className="schema-empty">{status}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="sidebar-nav-button"
          type="button"
          size="lg"
          tooltip="Database"
        >
          <Database className="size-4" aria-hidden />
          <span>Database</span>
          <ChevronDown className="sidebar-nav-chevron ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="workspace-menu"
        align="start"
        side="right"
      >
        <DropdownMenuLabel>Tables</DropdownMenuLabel>
        {tables.map((table) => (
          <DropdownMenuItem
            key={table.key}
            onClick={() => onPreviewTable(table.name)}
          >
            <Table2 className="size-4" aria-hidden />
            <div className="dropdown-table-item">
              <span>{table.name}</span>
              <small>{table.meta}</small>
            </div>
            <Eye className="ml-auto size-3.5" aria-hidden />
          </DropdownMenuItem>
        ))}
        {tables.length === 0 ? (
          <DropdownMenuItem disabled>
            {runtimeStatus === 'initializing'
              ? 'Preparing runtime'
              : 'No tables'}
          </DropdownMenuItem>
        ) : null}
        {status ? <DropdownMenuItem disabled>{status}</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddFile}>
          <UploadCloud className="size-4" aria-hidden />
          Add table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
