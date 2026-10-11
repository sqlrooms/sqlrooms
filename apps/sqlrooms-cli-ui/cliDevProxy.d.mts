import type {ProxyOptions} from 'vite';

export declare function createCliDevProxy(
  apiProxyTarget: string,
): Record<string, string | ProxyOptions>;
