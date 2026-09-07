/** Create the Vite routes that proxy CLI API and WebSocket traffic. */
export function createCliDevProxy(apiProxyTarget) {
  return {
    '/api': apiProxyTarget,
    '/config.json': apiProxyTarget,
    '/ws': {
      target: apiProxyTarget,
      ws: true,
    },
  };
}
