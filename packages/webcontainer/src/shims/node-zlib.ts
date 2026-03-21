export const constants = {
  Z_BEST_COMPRESSION: 9,
  Z_BEST_SPEED: 1,
  Z_DEFAULT_COMPRESSION: -1,
};

function unsupported(methodName: string): never {
  throw new Error(
    `${methodName} is not available in browser builds. just-bash gzip commands remain unsupported in this environment.`,
  );
}

export function gunzipSync(): never {
  return unsupported('gunzipSync');
}

export function gzipSync(): never {
  return unsupported('gzipSync');
}
