import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import type {ErrorComponentProps} from '@tanstack/react-router';
import type {QueryClient} from '@tanstack/react-query';
import * as React from 'react';
import appCss from '../styles.css?url';

type RouterContext = {
  queryClient: QueryClient;
};

const APP_NAME = 'SQLRooms';
const APP_TITLE = 'SQLRooms | Local-first data analysis workspace';
const APP_DESCRIPTION =
  'Explore files with DuckDB, worksheets, dashboards, charts, and AI-assisted data analysis.';

export const Route = createRootRouteWithContext<RouterContext>()({
  errorComponent: RootErrorComponent,
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: APP_TITLE},
      {name: 'description', content: APP_DESCRIPTION},
      {name: 'application-name', content: APP_NAME},
      {name: 'theme-color', content: '#111827'},
    ],
    links: [
      {rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml'},
      {rel: 'stylesheet', href: appCss},
    ],
  }),
  shellComponent: RootDocument,
});

function RootErrorComponent({error}: ErrorComponentProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      <section
        role="alert"
        aria-live="assertive"
        style={{
          width: 'min(440px, 100%)',
          border: '1px solid hsl(var(--border))',
          borderRadius: '10px',
          background: 'hsl(var(--card))',
          boxShadow: '0 20px 60px hsl(var(--foreground) / 12%)',
          padding: '24px',
        }}
      >
        <h1
          style={{
            margin: 0,
            color: 'hsl(var(--foreground))',
            fontSize: '24px',
            lineHeight: 1.2,
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            margin: '10px 0 20px',
            color: 'hsl(var(--muted-foreground))',
            fontSize: '15px',
            lineHeight: 1.45,
          }}
        >
          The workspace could not render. You can show the technical details if
          you need them for debugging.
        </p>
        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          style={{
            appearance: 'none',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            background: 'hsl(var(--secondary))',
            color: 'hsl(var(--secondary-foreground))',
            cursor: 'pointer',
            font: 'inherit',
            fontWeight: 600,
            padding: '8px 12px',
          }}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
        {showDetails ? (
          <pre
            style={{
              maxHeight: '240px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              margin: '18px 0 0',
              border: '1px solid hsl(var(--destructive))',
              borderRadius: '8px',
              color: 'hsl(var(--destructive))',
              padding: '12px',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            {message}
          </pre>
        ) : null}
      </section>
    </main>
  );
}

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
