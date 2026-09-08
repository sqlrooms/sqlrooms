import {TooltipProvider} from '@sqlrooms/ui';
import {QueryClientProvider} from '@tanstack/react-query';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import {setupRouterSsrQueryIntegration} from '@tanstack/react-router-ssr-query';
import {routeTree} from './routeTree.gen';
import {getContext} from './integrations/tanstack-query/root-provider';

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    Wrap: ({children}) => (
      <QueryClientProvider client={context.queryClient}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </QueryClientProvider>
    ),
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });

  setupRouterSsrQueryIntegration({router, queryClient: context.queryClient});

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
