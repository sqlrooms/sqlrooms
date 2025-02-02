[@sqlrooms/project-builder](../index.md) / ProjectStateContext

# Variable: ProjectStateContext

> `const` **ProjectStateContext**: `Context`\<`null` \| [`ProjectStore`](../type-aliases/ProjectStore.md)\<\{ `title`: `string`; `dataSources`: (\{ `type`: `"file"`; `tableName`: `string`; `fileName`: `string`; \} \| \{ `type`: `"url"`; `url`: `string`; `tableName`: `string`; \} \| \{ `type`: `"sql"`; `tableName`: `string`; `sqlQuery`: `string`; \})[]; `layout`: \{ `type`: `"mosaic"`; `nodes`: `null` \| `string` \| `MosaicLayoutParent`; `pinned`: `string`[]; `fixed`: `string`[]; \}; `sqlEditor`: \{ `queries`: `object`[]; `selectedQueryId`: `string`; \}; `description`: `string`; \}\>\>
