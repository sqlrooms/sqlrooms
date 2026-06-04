import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/workspaces/$workspaceId/')({
  ssr: false,
  component: lazyRouteComponent(
    () => import('./-index.lazy'),
    'WorkspaceRoute',
  ),
});
