import {ThemeProvider} from '@sqlrooms/ui';
import {useEffect, useState} from 'react';
import {Room} from './Room';

export const App = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        // Wait for global pyodide loader
        const waitForPyodide = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if ((window as any).loadPyodide) resolve();
              else setTimeout(check, 50);
            };
            check();
          });
        await waitForPyodide();

        // Initialize pyodide
        const pyodide = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
        });
        (window as any).pyodide = pyodide;
        // Ensure micropip and required packages
        await pyodide.loadPackage('micropip');
        await pyodide.runPythonAsync(`
import micropip
try:
    await micropip.install(['duckdb', 'pyarrow'])
except Exception:
    # If wheels already present or networking blocked, attempt import
    pass
import duckdb, pyarrow
`);
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div>Loading Pyodide and dependencies...</div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <Room />
    </ThemeProvider>
  );
};

