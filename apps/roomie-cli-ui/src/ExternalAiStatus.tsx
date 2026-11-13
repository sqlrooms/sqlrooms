import {
  Button,
  CopyButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';

/** Connection guidance for external assistants; status describes the browser bridge. */
export function ExternalAiStatus({status}: {status: string}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
          External AI · {status}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[80vh] w-96 max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto text-sm"
      >
        <div>
          <h2 className="font-medium">Connect your AI assistant</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Browser bridge: {status}. Ready means Roomie can accept requests; it
            does not confirm an assistant is connected or a skill is installed.
          </p>
        </div>
        <div className="space-y-2">
          <p>Run this in the terminal where Roomie is installed:</p>
          <SetupCommand command="roomie agent setup" />
          <p className="text-muted-foreground text-xs">
            Choose Claude Code, Codex, or Other MCP client. Setup previews
            changes and asks before installing a supported integration.
          </p>
        </div>
        <details>
          <summary className="cursor-pointer font-medium">Claude Code</summary>
          <div className="mt-2 space-y-2">
            <SetupCommand command="roomie agent setup --client claude-code" />
            <p className="text-muted-foreground text-xs">
              This previews the MCP configuration. Rerun with{' '}
              <code>--apply</code> to install it, then use the returned launch
              command to load the bundled Roomie skill in Claude Code.
            </p>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">Codex</summary>
          <div className="mt-2 space-y-2">
            <SetupCommand command="roomie agent setup --client codex" />
            <p className="text-muted-foreground text-xs">
              This previews the MCP configuration and Roomie skill installation.
              Rerun with <code>--apply</code> to install them, then restart
              Codex.
            </p>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">
            Other MCP clients
          </summary>
          <p className="text-muted-foreground mt-2 text-xs">
            Run <code>roomie agent setup</code> and choose Other MCP client for
            stdio connection settings and the bundled skill location. Add the
            server in your client’s MCP settings. Copy the skill into its skill
            directory, or add the contents to its agent instructions. MCP setup
            establishes the connection; the skill provides workflow guidance.
          </p>
        </details>
        <div className="space-y-2 border-t pt-3">
          <h3 className="font-medium">Already configured?</h3>
          <p className="text-muted-foreground text-xs">
            Ask your assistant to use Roomie to open this database. Keep this
            browser tab open while it works. If you just installed the
            integration, restart your assistant; for Claude Code, use the
            returned launch command. Run <code>roomie agent status</code> for
            workspace diagnostics.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SetupCommand({command}: {command: string}) {
  return (
    <div className="bg-muted flex items-center gap-2 rounded-md p-2">
      <code className="min-w-0 flex-1 text-xs break-words">{command}</code>
      <CopyButton
        text={command}
        className="shrink-0"
        tooltipLabel="Copy command"
        ariaLabel={`Copy ${command}`}
      />
    </div>
  );
}
