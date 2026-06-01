export const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;
export const PARQUET_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
