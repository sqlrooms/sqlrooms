import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import type {QueryClient} from '@tanstack/react-query';
import type React from 'react';
import appCss from '../styles.css?url';

type RouterContext = {
  queryClient: QueryClient;
};

const APP_NAME = 'SQLRooms';
const APP_TITLE = 'SQLRooms | Local-first data analysis workspace';
const APP_DESCRIPTION =
  'Explore files with DuckDB, worksheets, dashboards, charts, and AI-assisted data analysis.';

export const Route = createRootRouteWithContext<RouterContext>()({
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
