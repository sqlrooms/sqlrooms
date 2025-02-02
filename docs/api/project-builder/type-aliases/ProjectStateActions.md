[@sqlrooms/project-builder](../index.md) / ProjectStateActions

# Type Alias: ProjectStateActions\<PC\>

> **ProjectStateActions**\<`PC`\>: `object`

## Type Parameters

| Type Parameter |
| ------ |
| `PC` *extends* `BaseProjectConfig` |

## Type declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| <a id="settaskprogress"></a> `setTaskProgress` | (`id`, `taskProgress`) => `void` | - |
| <a id="getloadingprogress"></a> `getLoadingProgress` | () => [`TaskProgress`](TaskProgress.md) \| `undefined` | - |
| <a id="reset"></a> `reset` | () => `Promise`\<`void`\> | - |
| <a id="reinitialize"></a> `reinitialize` | (`opts`?) => `Promise`\<`void`\> | Reinitialize the project state. Called when the project is first loaded. |
| <a id="setprojectconfig"></a> `setProjectConfig` | (`config`) => `void` | - |
| <a id="setprojectid"></a> `setProjectId` | (`projectId`) => `void` | - |
| <a id="setlastsavedconfig"></a> `setLastSavedConfig` | (`config`) => `void` | - |
| <a id="hasunsavedchanges"></a> `hasUnsavedChanges()` |  | - |
| <a id="setlayout"></a> `setLayout()` |  | - |
| <a id="togglepanel"></a> `togglePanel` | (`panel`, `show`?) => `void` | - |
| <a id="togglepanelpin"></a> `togglePanelPin` | (`panel`) => `void` | - |
| <a id="addorupdatesqlquery"></a> `addOrUpdateSqlQuery()` |  | - |
| <a id="removesqlquerydatasource"></a> `removeSqlQueryDataSource()` |  | - |
| <a id="replaceprojectfile"></a> `replaceProjectFile()` |  | - |
| <a id="addprojectfile"></a> `addProjectFile()` |  | - |
| <a id="removeprojectfile"></a> `removeProjectFile()` |  | - |
| <a id="maybedownloaddatasources"></a> `maybeDownloadDataSources()` |  | - |
| <a id="setprojectfiles"></a> `setProjectFiles()` |  | - |
| <a id="setprojectfileprogress"></a> `setProjectFileProgress()` |  | - |
| <a id="adddatasource"></a> `addDataSource` | (`dataSource`, `status`?) => `Promise`\<`void`\> | - |
| <a id="gettable"></a> `getTable()` |  | - |
| <a id="settables"></a> `setTables()` |  | - |
| <a id="settablerowcount"></a> `setTableRowCount()` |  | - |
| <a id="setprojecttitle"></a> `setProjectTitle()` |  | - |
| <a id="setdescription"></a> `setDescription()` |  | - |
| <a id="aredatasetsready"></a> `areDatasetsReady()` |  | - |
| <a id="setsqleditorconfig"></a> `setSqlEditorConfig` | (`config`) => `void` | - |
| <a id="findtablebyname"></a> `findTableByName()` |  | - |
| <a id="updatereadydatasources"></a> `updateReadyDataSources()` |  | - |
| <a id="ondataupdated"></a> `onDataUpdated` | () => `Promise`\<`void`\> | - |
| <a id="areviewsreadytorender"></a> `areViewsReadyToRender()` |  | - |
