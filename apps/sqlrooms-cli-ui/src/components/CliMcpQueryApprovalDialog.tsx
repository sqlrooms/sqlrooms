import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {
  resolveMcpQueryApproval,
  useMcpQueryApproval,
} from '../mcpQueryApproval';

/** Presents allow-once decisions for database writes and reads beyond ordinary workspace tables. */
export function CliMcpQueryApprovalDialog() {
  const {active} = useMcpQueryApproval();

  return (
    <Dialog open={Boolean(active)}>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {active ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {active.kind === 'write'
                  ? 'Allow this database change?'
                  : 'Allow this external data read?'}
              </DialogTitle>
              <DialogDescription>
                {active.kind === 'write'
                  ? 'This command changes the database. Existing data may be replaced or deleted as specified below.'
                  : 'This SELECT uses files, URLs, views, or functions that cannot be verified as ordinary workspace reads.'}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">MCP client</dt>
              <dd className="min-w-0 font-medium break-words">
                {active.clientName}
                {active.clientVersion ? ` ${active.clientVersion}` : ''}
              </dd>
              <dt className="text-muted-foreground">Workspace</dt>
              <dd className="min-w-0 break-words">{active.roomTitle}</dd>
              <dt className="text-muted-foreground">Database</dt>
              <dd className="min-w-0 break-words">{active.database}</dd>
              <dt className="text-muted-foreground">Database path</dt>
              <dd className="min-w-0 font-mono text-xs break-all">
                {active.databasePath}
              </dd>
              {active.commandId ? (
                <>
                  <dt>Command</dt>
                  <dd>{active.commandId}</dd>
                </>
              ) : null}
              {active.maxRows !== undefined ? (
                <>
                  <dt className="text-muted-foreground">Maximum rows</dt>
                  <dd>{active.maxRows}</dd>
                </>
              ) : null}
            </dl>
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {active.kind === 'write'
                  ? 'Complete command input'
                  : 'Complete SQL'}
              </div>
              <pre className="bg-muted max-h-72 overflow-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">
                {active.sql}
              </pre>
            </div>
            <p className="text-muted-foreground text-xs">
              The client identity comes from its MCP initialization handshake.
              Approval is valid for this request only and expires automatically.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => resolveMcpQueryApproval(active.id, 'deny')}
              >
                Deny
              </Button>
              <Button
                type="button"
                onClick={() => resolveMcpQueryApproval(active.id, 'allow')}
              >
                Allow once
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
