[@sqlrooms/utils](../index.md) / postData

# Function: postData()

> **postData**(`params`): `Promise`\<`any`\>

Posts data to a specified URL endpoint using fetch API

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | \{ `url`: `string`; `data`: `Record`\<`string`, `unknown`\>; \} | The parameters for the POST request |
| `params.url` | `string` | The URL to send the POST request to |
| `params.data`? | `Record`\<`string`, `unknown`\> | Optional data to be sent in the request body |

## Returns

`Promise`\<`any`\>

The parsed JSON response from the server

## Throws

If the response is not ok, throws an error with the status message or error details
