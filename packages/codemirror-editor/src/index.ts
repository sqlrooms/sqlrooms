// Components
export {CodeMirrorEditor} from './components/CodeMirrorEditor';
export type {CodeMirrorEditorProps} from './components/CodeMirrorEditor';

export {JsonCodeMirrorEditor} from './components/JsonCodeMirrorEditor';
export type {JsonCodeMirrorEditorProps} from './components/JsonCodeMirrorEditor';

export {DuckdbCodeMirrorEditor} from './components/DuckdbCodeMirrorEditor';
export type {DuckdbCodeMirrorEditorProps} from './components/DuckdbCodeMirrorEditor';

export {JavascriptCodeMirrorEditor} from './components/JavascriptCodeMirrorEditor';
export type {JavascriptCodeMirrorEditorProps} from './components/JavascriptCodeMirrorEditor';

// Themes
export {createBaseTheme} from './themes/base-theme';
export {createSqlroomsTheme} from './themes/sqlrooms-theme';
export {createJsonTheme} from './themes/json-theme';
export {createSqlTheme} from './themes/sql-theme';

// Extensions (for advanced users who want to customize)
export {jsonSchemaLinter} from './extensions/json-schema-lint';
export {jsonSchemaAutocomplete} from './extensions/json-schema-autocomplete';
export {autoTriggerOnQuote} from './extensions/auto-trigger';
export {createDuckDbSqlLanguage} from './extensions/duckdb-sql-language';
export {createDuckDbCompletion} from './extensions/duckdb-completion';
export {createSqlKeymap} from './extensions/sql-keymap';
