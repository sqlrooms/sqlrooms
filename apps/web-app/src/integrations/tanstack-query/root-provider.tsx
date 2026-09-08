import {QueryClient} from '@tanstack/react-query';

let queryClient: QueryClient | undefined;

export function getContext() {
  queryClient ??= new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 15,
        refetchOnWindowFocus: false,
      },
    },
  });

  return {queryClient};
}
