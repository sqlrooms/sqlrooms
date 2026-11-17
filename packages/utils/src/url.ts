const OBJECT_STORE_URL_RE = /^(s3|gs):\/\/([^/?#]+)(.*)$/i;

/**
 * Rewrites public object-store URLs to the `https://` form browsers can fetch:
 *
 * - `s3://bucket/key` → `https://bucket.s3.amazonaws.com/key`
 * - `gs://bucket/key` → `https://storage.googleapis.com/bucket/key`
 *
 * Other URLs are returned unchanged. This only works for publicly readable
 * objects; private buckets need signed URLs instead.
 *
 * @param url - The URL to rewrite.
 * @returns The `https://` URL, or `url` unchanged if it is not `s3://` or `gs://`.
 *
 * @example
 * ```ts
 * toPublicHttpsUrl('s3://my-bucket/data/file.parquet');
 * // 'https://my-bucket.s3.amazonaws.com/data/file.parquet'
 * ```
 */
export function toPublicHttpsUrl(url: string): string {
  const match = OBJECT_STORE_URL_RE.exec(url.trim());
  if (!match) return url;
  const [, scheme, bucket, rest] = match;
  const path = rest || '/';
  return scheme!.toLowerCase() === 's3'
    ? `https://${bucket}.s3.amazonaws.com${path}`
    : `https://storage.googleapis.com/${bucket}${path}`;
}
