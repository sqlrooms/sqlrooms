# @sqlrooms/s3-browser-config

React-free Zod schemas for `@sqlrooms/s3-browser` configuration and object
metadata. Use this package in servers, migrations, tests, and other code that
does not need the browser UI.

## Schemas

- `S3Config` validates connection input: access key, secret, region, bucket,
  and optional name or session token.
- `S3Credentials` extends the connection fields with a UUID and ISO created and
  updated timestamps for saved credential records.
- `S3FileOrDirectory` is a discriminated union for S3 prefixes and objects.
  Objects may include a `Date` for `lastModified`, byte size, and content type.

```ts
import {S3Config, S3FileOrDirectory} from '@sqlrooms/s3-browser-config';

const config = S3Config.parse({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: 'eu-central-1',
  bucket: 'analytics-data',
});

const entry = S3FileOrDirectory.parse({
  key: 'exports/report.parquet',
  isDirectory: false,
  size: 12_345,
  contentType: 'application/vnd.apache.parquet',
});
```

These schemas validate data but do not encrypt or store credentials. Keep
secret values out of logs and client-side persistence unless the host
application explicitly provides a secure storage policy.
