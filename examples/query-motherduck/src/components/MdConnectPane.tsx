import {MDConnection} from '@motherduck/wasm-client';
import {Button, cn, Input} from '@sqlrooms/ui';
import {CheckIcon, KeyIcon} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';

const motherDuckUrl = 'https://app.motherduck.com';

const appName = 'SQLRooms MotherDuck Query Example';

export function MdConnectPane({
  className,
  connection,
  connect,
}: {
  className?: string;
  connection: MDConnection | null;
  connect: (token: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInClipboard, setTokenInClipboard] = useState<boolean>(false);

  const handleTokenInputChange = useCallback((value: string) => {
    setToken(value);
  }, []);

  const handleGetTokenButtonClick = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tokenInClipboard', 'y');
    window.location.href = `${motherDuckUrl}/token-request?appName=${encodeURIComponent(
      appName,
    )}&returnTo=${encodeURIComponent(url.toString())}`;
  }, []);

  const handleConnectButtonClick = useCallback(() => {
    if (token) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tokenInClipboard')) {
        url.searchParams.delete('tokenInClipboard');
        history.pushState({}, '', url);
      }
      connect(token);
    }
  }, [connect, token]);

  useEffect(() => {
    async function attemptConnect() {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tokenInClipboard')) {
        // This only works in Chrome. User has to manually paste in other browsers (Firefox, Safari).
        if (navigator.clipboard.readText) {
          const token = await navigator.clipboard.readText();
          if (token) {
            url.searchParams.delete('tokenInClipboard');
            history.pushState({}, '', url);
            connect(token);
            return;
          }
        }
        setTokenInClipboard(true);
      }
    }
    attemptConnect();
  }, [connect]);

  const setTextInputRef = useCallback((element: HTMLInputElement | null) => {
    if (element) {
      element.focus();
    }
  }, []);

  return (
    <div id="connect-pane" className={cn('flex flex-col gap-4', className)}>
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Connect to MotherDuck
        </h3>
      </div>

      <div
        className="rounded bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300"
        style={{visibility: tokenInClipboard ? 'visible' : 'hidden'}}
      >
        Your token is in the clipboard. Paste it and click Connect.
      </div>

      {/* Option 1: Paste existing token */}
      <div className="flex flex-col gap-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm font-medium text-white">
            <CheckIcon className="h-4 w-4" />
          </span>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Use existing MotherDuck access token
          </h4>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          If you have a MotherDuck access token, paste it here. It will be saved
          in your browser's local storage.
        </p>
        <div className="flex gap-2">
          <div className="relative flex w-full items-center">
            <KeyIcon className="absolute left-2 h-4 w-4" />
            <Input
              ref={setTextInputRef}
              type="password"
              autoComplete="off"
              placeholder="Paste MotherDuck access token here"
              onChange={(e) => handleTokenInputChange(e.target.value)}
              className="flex-1 pl-8"
            />
          </div>
          <Button
            disabled={!(!connection && token)}
            onClick={handleConnectButtonClick}
          >
            Connect
          </Button>
        </div>
      </div>

      {/* Option 2: Get token automatically */}
      <div className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            <KeyIcon className="h-4 w-4" />
          </span>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Create a new token
          </h4>
        </div>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Get one automatically from MotherDuck:
        </p>
        <Button onClick={handleGetTokenButtonClick} className="w-full">
          Get New Token from MotherDuck
        </Button>
      </div>

      {/* Documentation link */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Need help? View{' '}
          <a
            href="https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/authenticating-to-motherduck/#authentication-using-an-access-token"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            MotherDuck access token documentation
          </a>
        </p>
      </div>
    </div>
  );
}
