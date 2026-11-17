import {toPublicHttpsUrl} from '../src/url';

describe('toPublicHttpsUrl', () => {
  it('rewrites s3:// URLs to virtual-hosted S3 URLs', () => {
    expect(toPublicHttpsUrl('s3://my-bucket/path/to/data.parquet')).toBe(
      'https://my-bucket.s3.amazonaws.com/path/to/data.parquet',
    );
  });

  it('rewrites gs:// URLs to storage.googleapis.com URLs', () => {
    expect(toPublicHttpsUrl('gs://my-bucket/path/to/data.csv')).toBe(
      'https://storage.googleapis.com/my-bucket/path/to/data.csv',
    );
  });

  it('keeps the query string', () => {
    expect(toPublicHttpsUrl('s3://b/key.parquet?versionId=1')).toBe(
      'https://b.s3.amazonaws.com/key.parquet?versionId=1',
    );
  });

  it('handles a bucket without a key', () => {
    expect(toPublicHttpsUrl('s3://b')).toBe('https://b.s3.amazonaws.com/');
    expect(toPublicHttpsUrl('gs://b')).toBe(
      'https://storage.googleapis.com/b/',
    );
  });

  it('is case-insensitive for the scheme', () => {
    expect(toPublicHttpsUrl('S3://b/k')).toBe('https://b.s3.amazonaws.com/k');
    expect(toPublicHttpsUrl('GS://b/k')).toBe(
      'https://storage.googleapis.com/b/k',
    );
  });

  it('leaves other URLs unchanged', () => {
    for (const url of [
      'https://example.com/data.csv',
      'http://example.com/s3://b/k',
      'data.csv',
      'file:///tmp/data.csv',
      's3:/missing-slash',
    ]) {
      expect(toPublicHttpsUrl(url)).toBe(url);
    }
  });
});
