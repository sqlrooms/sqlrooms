Shared utility functions used across SQLRooms packages and apps.

## Installation

```bash
npm install @sqlrooms/utils
```

## String and formatting helpers

```ts
import {
  capitalize,
  camelCaseToTitle,
  truncate,
  formatBytes,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTimeRelative,
} from '@sqlrooms/utils';

capitalize('hello'); // "Hello"
camelCaseToTitle('tableRowCount'); // "Table Row Count"
truncate('This is a long sentence', 10); // "This is..."

formatBytes(1048576); // "1 MB"
formatNumber(1234567.89); // "1,234,568"
formatDate(new Date()); // "2026-02-23"
formatDateTime(new Date()); // "Mon 2026-02-23 02:15 PM"
formatTimeRelative(Date.now() - 60_000); // "a minute ago"
```

`formatTimeRelative` takes an optional second argument, the point to measure
from; it defaults to now. Passing it explicitly keeps the result a pure function
of its inputs, which is what lets a React component recompute the label on a
clock tick instead of relying on a hidden read of the current time:

```ts
formatTimeRelative(completedAt, now); // "18 minutes ago", relative to `now`
```

## File/table name helpers

```ts
import {
  convertToValidColumnOrTableName,
  convertToUniqueColumnOrTableName,
  generateUniqueName,
  splitFilePath,
  generateUniquePath,
} from '@sqlrooms/utils';

convertToValidColumnOrTableName('My File.csv'); // "My_File"
convertToUniqueColumnOrTableName('sales.csv', ['sales']); // "sales_1"
generateUniqueName('query', ['query', 'query_1']); // "query_2"

splitFilePath('folder/data.parquet');
// { dir: "folder", name: "data", ext: "parquet", filename: "data.parquet" }

generateUniquePath('results.csv', ['results.csv']); // "results_1.csv"
```

## Network and JSON helpers

```ts
import {
  safeJsonParse,
  downloadFile,
  uploadFile,
  postData,
} from '@sqlrooms/utils';

const parsed = safeJsonParse('{"ok": true}'); // { ok: true }
const invalid = safeJsonParse('{'); // undefined

// downloadFile / uploadFile / postData are Promise-based XHR helpers
```

## Other useful exports

- `memoizeOnce`
- `opacifyHex`
- `formatCount`, `formatCountShort`, `shorten`
- decimal helpers:
  - `isNegativeDecimal`
  - `negateDecimal`
  - `toDecimalString`
  - `toDecimalNumber`
  - `fromDecimalString`
