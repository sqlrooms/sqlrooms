# Type Alias: ProjectStateProps\<PC\>

> **ProjectStateProps**\<`PC`\>: `object`

## Type Parameters

| Type Parameter |
| ------ |
| `PC` *extends* `BaseProjectConfig` |

## Type declaration

| Name | Type |
| ------ | ------ |
| <a id="schema"></a> `schema` | `string` |
| <a id="tasksprogress"></a> `tasksProgress` | `Record`\<`string`, [`TaskProgress`](TaskProgress.md)\> |
| <a id="projectid"></a> `projectId` | `string` \| `undefined` |
| <a id="password"></a> `password` | `string` \| `undefined` |
| <a id="projectfolder"></a> `projectFolder` | `string` \| `undefined` |
| <a id="projectconfig"></a> `projectConfig` | `PC` |
| <a id="projectpanels"></a> `projectPanels` | `Record`\<`string`, [`ProjectPanelInfo`](ProjectPanelInfo.md)\> |
| <a id="ispublic"></a> `isPublic` | `boolean` |
| <a id="isreadonly"></a> `isReadOnly` | `boolean` |
| <a id="tables"></a> `tables` | `DataTable`[] |
| <a id="projectfiles"></a> `projectFiles` | [`ProjectFileInfo`](../../types/type-aliases/ProjectFileInfo.md)[] |
| <a id="projectfilesprogress"></a> `projectFilesProgress` | \{\} |
| <a id="lastsavedconfig"></a> `lastSavedConfig` | `PC` \| `undefined` |
| <a id="initialized"></a> `initialized` | `boolean` |
| <a id="isdataavailable"></a> `isDataAvailable` | `boolean` |
| <a id="datasourcestates"></a> `dataSourceStates` | \{\} |
| <a id="tablerowcounts"></a> `tableRowCounts` | \{\} |
| <a id="captureexception"></a> `captureException` | (`exception`, `captureContext`?) => `void` |
| <a id="customerrorboundary"></a> `CustomErrorBoundary` | `React.ComponentType`\<\{ `onRetry`: () => `void`; `children`: `ReactNode`; \}\> |
