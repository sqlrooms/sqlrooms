[@sqlrooms/sql-editor](../index.md) / Props

# Type Alias: Props

> **Props**: `object`

## Type declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| <a id="schema"></a> `schema`? | `string` | The database schema to use for queries. Defaults to 'main' |
| <a id="isopen"></a> `isOpen` | `boolean` | Whether the SQL editor is currently visible |
| <a id="documentationpanel"></a> `documentationPanel`? | `React.ReactNode` | Optional component to render SQL documentation in the side panel |
| <a id="sqleditorconfig"></a> `sqlEditorConfig` | `SqlEditorConfig` | Configuration object containing queries and selected query state |
| <a id="onchange"></a> `onChange` | (`config`) => `void` | Callback fired when the SQL editor configuration changes |
| <a id="onclose"></a> `onClose` | () => `void` | Callback fired when the SQL editor should be closed |
| <a id="onaddorupdatesqlquery"></a> `onAddOrUpdateSqlQuery` | `CreateTableModalProps`\[`"onAddOrUpdateSqlQuery"`\] | Callback fired when a new table should be created from query results |
