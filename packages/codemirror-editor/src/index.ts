// Components
export {CodeMirrorEditor} from './components/CodeMirrorEditor';
export type {CodeMirrorEditorProps} from './components/CodeMirrorEditor';

export {JsonCodeMirrorEditor} from './components/JsonCodeMirrorEditor';
export type {JsonCodeMirrorEditorProps} from './components/JsonCodeMirrorEditor';

// Themes
export {createSqlroomsTheme} from './themes/sqlrooms-theme';
export {createJsonTheme} from './themes/json-theme';

// Extensions (for advanced users who want to customize)
export {jsonSchemaLinter} from './extensions/json-schema-lint';
export {jsonSchemaAutocomplete} from './extensions/json-schema-autocomplete';
export {autoTriggerOnQuote} from './extensions/auto-trigger';
