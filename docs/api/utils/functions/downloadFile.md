[@sqlrooms/utils](../index.md) / downloadFile

# Function: downloadFile()

> **downloadFile**(`url`, `opts`?): `Promise`\<`Uint8Array`\>

Downloads a file from a specified URL using XMLHttpRequest

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `url` | `string` | The URL to download the file from |
| `opts`? | \{ `method`: `string`; `headers`: `Record`\<`string`, `string`\>; `onProgress`: (`info`) => `void`; \} | Optional configuration for the download |
| `opts.method`? | `string` | The HTTP method to use |
| `opts.headers`? | `Record`\<`string`, `string`\> | Additional headers to include in the request |
| `opts.onProgress`? | (`info`) => `void` | Callback function to track download progress |

## Returns

`Promise`\<`Uint8Array`\>

The downloaded file as a Uint8Array

## Throws

Throws an object containing status and error message if download fails
