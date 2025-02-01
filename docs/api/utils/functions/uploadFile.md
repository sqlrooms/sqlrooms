[@sqlrooms/utils](../index.md) / uploadFile

# Function: uploadFile()

> **uploadFile**(`url`, `content`, `opts`?): `Promise`\<`Response`\>

Uploads a file to a specified URL using XMLHttpRequest

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `url` | `string` | The URL to upload the file to |
| `content` | `File` \| `Blob` \| `FormData` | The content to upload |
| `opts`? | \{ `method`: `string`; `headers`: `Record`\<`string`, `string`\>; `onProgress`: (`info`) => `void`; \} | Optional configuration for the upload |
| `opts.method`? | `string` | The HTTP method to use |
| `opts.headers`? | `Record`\<`string`, `string`\> | Additional headers to include in the request |
| `opts.onProgress`? | (`info`) => `void` | Callback function to track upload progress |

## Returns

`Promise`\<`Response`\>

The server response

## Throws

Throws an object containing status and error message if upload fails
