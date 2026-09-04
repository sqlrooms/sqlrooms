import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  ssr: false,
  component: lazyRouteComponent(() => import('./-index.lazy'), 'IndexRoute'),
});
