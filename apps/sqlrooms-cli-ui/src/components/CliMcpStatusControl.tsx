import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@sqlrooms/ui';
import {Check, Copy, LoaderCircle} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {runtimeConfig} from '../runtimeEnvironment';
import {
  fetchMcpStatus,
  type McpRuntimeStatus,
  setMcpEnabled,
} from '../serverApi';

const STATUS_LABEL: Record<McpRuntimeStatus['status'], string> = {
  off: 'MCP OFF',
  waiting: 'MCP WAITING',
  ready: 'MCP READY',
  working: 'MCP WORKING',
  error: 'MCP ERROR',
};

export function CliMcpStatusControl() {
  const initial = runtimeConfig.mcp;
  const [status, setStatus] = useState<McpRuntimeStatus | undefined>(
    initial
      ? {
          status: initial.enabled ? 'waiting' : 'off',
          enabled: initial.enabled,
          url: initial.url,
          bridge: {status: 'waiting', pendingRequests: 0},
        }
      : undefined,
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string>();
  const [copyError, setCopyError] = useState<string>();
  const copiedTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!initial) return;
    try {
      setStatus(await fetchMcpStatus(runtimeConfig));
    } catch (error) {
      setStatus((current) => ({
        status: 'error',
        enabled: current?.enabled ?? false,
        url: current?.url ?? initial.url,
        bridge: current?.bridge ?? {status: 'waiting', pendingRequests: 0},
        lastError:
          error instanceof Error ? error.message : 'Status unavailable.',
      }));
    }
  }, [initial]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  if (!initial || !status) return null;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(undefined);
      setCopied(label);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => {
        setCopied(undefined);
        copiedTimer.current = undefined;
      }, 1_500);
    } catch (error) {
      setCopyError(
        error instanceof Error ? error.message : 'Clipboard access failed.',
      );
    }
  };
  const toggle = async () => {
    setBusy(true);
    try {
      setStatus(await setMcpEnabled(runtimeConfig, !status.enabled));
    } catch (error) {
      setStatus((current) => ({
        ...(current ?? status),
        status: 'error',
        lastError:
          error instanceof Error ? error.message : 'MCP action failed.',
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-1.5">
          <Badge
            variant={status.status === 'error' ? 'destructive' : 'secondary'}
            className="font-mono text-[10px] tracking-wide"
          >
            {STATUS_LABEL[status.status]}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[25rem] space-y-3">
        <div>
          <div className="font-medium">External MCP control</div>
          <p className="text-muted-foreground mt-1 text-xs">
            Lets a local MCP client query data and run guarded room commands in
            this live browser workspace.
          </p>
        </div>
        <div className="bg-muted flex items-center gap-2 rounded-md p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{status.url}</code>
          <CopyButton
            copied={copied === 'URL'}
            label="Copy URL"
            onClick={() => void copy('URL', status.url)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Listener</span>
            <div className="font-medium">{status.status}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Browser bridge</span>
            <div className="font-medium">{status.bridge.status}</div>
          </div>
        </div>
        {status.lastError ? (
          <p className="text-destructive text-xs">{status.lastError}</p>
        ) : null}
        {copyError ? (
          <p className="text-destructive text-xs">{copyError}</p>
        ) : null}
        <Separator />
        <p className="text-muted-foreground text-xs">
          To connect Claude Code, start SQLRooms with <code>--claude</code>.
          Other native clients authenticate using the private credential file
          reported in the launching terminal. Keep that file local.
        </p>
        <Button
          type="button"
          className="w-full"
          variant={status.enabled ? 'outline' : 'default'}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          {status.enabled ? 'Stop MCP server' : 'Start MCP server'}
        </Button>
        <p className="text-muted-foreground text-[11px]">
          MCP shares the HTTP listener. Port changes require restarting SQLRooms
          with <code>--port</code>.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({
  copied,
  label,
  onClick,
}: {
  copied: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={label}
      onClick={onClick}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
