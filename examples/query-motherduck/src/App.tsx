import {ThemeProvider} from '@sqlrooms/ui';
import {useEffect, useState} from 'react';
import {MdConnectPane} from './MdConnectPane';
import {Room} from './Room';

export const MD_TOKEN_KEY = 'motherduck-token';

export const App = () => {
  const [mdToken, setMdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(MD_TOKEN_KEY);
    if (savedToken) {
      setMdToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  // Handle token connection
  const handleConnect = (token: string) => {
    localStorage.setItem(MD_TOKEN_KEY, token);
    setMdToken(token);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div>Loading...</div>
        </div>
      );
    }

    if (!mdToken) {
      return (
        <div className="flex h-screen w-screen items-center justify-center">
          <MdConnectPane
            className="mx-auto w-full max-w-md"
            connection={null}
            connect={handleConnect}
          />
        </div>
      );
    }

    return (
      <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
        <Room mdToken={mdToken} />
      </ThemeProvider>
    );
  };

  return renderContent();
};
