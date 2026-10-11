export const constants = {
  Z_BEST_COMPRESSION: 9,
  Z_BEST_SPEED: 1,
  Z_DEFAULT_COMPRESSION: -1,
};

function unsupported(methodName: string): never {
  throw new Error(
    `${methodName} is not available in browser builds (synchronous zlib APIs unsupported). The browser environment may still support gzip via other means.`,
  );
}

export function gunzipSync(): never {
  return unsupported('gunzipSync');
}

export function gzipSync(): never {
  return unsupported('gzipSync');
}
