[@sqlrooms/project-config](../index.md) / BaseProjectConfig

# Type Alias: BaseProjectConfig

> **BaseProjectConfig**: `object`

## Type declaration

| Name | Type |
| ------ | ------ |
| <a id="title"></a> `title` | `string` |
| <a id="description"></a> `description`? | `string` |
| <a id="datasources"></a> `dataSources` | (\{ `tableName`: `string`; `type`: `"file"`; `fileName`: `string`; \} \| \{ `tableName`: `string`; `type`: `"url"`; `url`: `string`; \} \| \{ `tableName`: `string`; `type`: `"sql"`; `sqlQuery`: `string`; \})[] |
| <a id="layout"></a> `layout` | \{ `type`: `"mosaic"`; `nodes`: `null` \| `string` \| [`MosaicLayoutParent`](MosaicLayoutParent.md); `pinned`: `string`[]; `fixed`: `string`[]; \} |
| <a id="sqleditor"></a> `sqlEditor` | \{ `queries`: `object`[]; `selectedQueryId`: `string`; \} |
