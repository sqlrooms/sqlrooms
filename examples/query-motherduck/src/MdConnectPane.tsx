import {MDConnection} from '@motherduck/wasm-client';
import {useCallback, useEffect, useState} from 'react';
import './ConnectPane.css';
import {Button} from '@sqlrooms/ui';

const motherDuckUrl = 'https://app.motherduck.com';

const appName = 'WASM Client Library Example: NYPD Complaints';

export function MdConnectPane({
  connection,
  connect,
}: {
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
    <div id="connect-pane" className="pt-32">
      <div
        className="rounded bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300"
        style={{visibility: tokenInClipboard ? 'visible' : 'hidden'}}
      >
        Your token is in the clipboard. Paste it and click Connect.
      </div>
      <div id="token-input-row">
        <TextInput
          ref={setTextInputRef}
          type="password"
          autoComplete="off"
          placeholder="Paste MotherDuck Service Token Here"
          onValueChange={handleTokenInputChange}
        />
      </div>
      <div id="connect-button-row">
        <Button onClick={handleGetTokenButtonClick}>Get Token</Button>
        <Button
          disabled={!(!connection && token)}
          onClick={handleConnectButtonClick}
          style={{marginLeft: 8}}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
