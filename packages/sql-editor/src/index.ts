/**
 * {@include ../README.md}
 * @packageDocumentation
 */
export {default as CreateTableModal} from './components/CreateTableModal';
export type {
  CreateTableModalProps,
  CreateTableFormInitialValues,
} from './components/CreateTableModal';
export {default as SqlEditor} from './SqlEditor';
export type {SqlEditorProps} from './SqlEditor';
export {default as SqlEditorModal} from './SqlEditorModal';
export {createSqlEditorSlice} from './SqlEditorSlice';
export type {QueryResult, SqlEditorSliceState} from './SqlEditorSlice';
export {SqlQueryDataSourcesPanel} from './components/SqlQueryDataSourcesPanel';
export {SqlMonacoEditor} from './SqlMonacoEditor';
export type {SqlMonacoEditorProps} from './SqlMonacoEditor';
export {TableStructurePanel} from './components/TableStructurePanel';
export type {TableStructurePanelProps} from './components/TableStructurePanel';
export {QueryResultPanel} from './components/QueryResultPanel';
export type {QueryResultPanelProps} from './components/QueryResultPanel';
export {SqlEditorHeader} from './components/SqlEditorHeader';
export type {SqlEditorHeaderProps} from './components/SqlEditorHeader';
export {
  SqlReferenceButton,
  SqlReferenceButtonContent,
} from './components/SqlReferenceButton';
export {QueryEditorPanel} from './components/QueryEditorPanel';
export type {QueryEditorPanelProps} from './components/QueryEditorPanel';
export {QueryEditorPanelActions} from './components/QueryEditorPanelActions';
export {QueryEditorPanelTabsList} from './components/QueryEditorPanelTabsList';
export {QueryEditorPanelEditor} from './components/QueryEditorPanelEditor';
export {QueryResultLimitSelect} from './components/QueryResultLimitSelect';
export type {QueryResultLimitSelectProps} from './components/QueryResultLimitSelect';
export {SqlQueryPreview} from './components/SqlQueryPreview';
export type {SqlQueryPreviewProps} from './components/SqlQueryPreview';

// Re-export from @sqlrooms/sql-editor-config
// Values also export their corresponding types automatically (Zod pattern)
export {
  SqlEditorSliceConfig,
  createDefaultSqlEditorConfig,
} from '@sqlrooms/sql-editor-config';
