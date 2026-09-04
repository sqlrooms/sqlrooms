declare module 'cloudflare:workers' {
  export const env: {
    USER_FILES_BUCKET?: R2Bucket;
  };
}
