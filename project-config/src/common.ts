import {z} from 'zod';

export const DEFAULT_PROJECT_TITLE = 'Untitled project';

export enum ProjectPanelTypes {
  PROJECT_DETAILS = 'project-details',
  DATA_SOURCES = 'data-sources',
  DATA_TABLES = 'data-tables',
  FILTERS = 'filters',
  VIEW_CONFIGURATION = 'view-configuration',
  DOCS = 'docs',
  CHARTS = 'charts',
  MAIN_VIEW = 'main-view',
}

export function isProjectPanelType(value: any): value is ProjectPanelTypes {
  return Object.values(ProjectPanelTypes).includes(value);
}

/*
(?=.*\p{L}) ensures that at least one Unicode letter character is present. \p{L} matches any kind of letter from any script or language.
[\p{L}\d\s\.,\-:;'"!?&()]+ matches one or more occurrences of Unicode letter characters, digits, whitespace, periods, commas etc
*/
// export const VALID_TITLE_REGEX = /^(?=.*\p{L})[\p{L}\d\s\.,\-:;'"!?&()]+$/u;
export const VALID_TITLE_REGEX = /^.*$/;
export const VALID_TABLE_OR_COLUMN_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

export const AttributeType = z.enum(['numeric', 'string', 'date']);
export type AttributeType = z.infer<typeof AttributeType>;

export const AttributeColumn = z.object({
  type: AttributeType.optional(),
  column: z.string().regex(VALID_TABLE_OR_COLUMN_REGEX),
  label: z.string().min(2).max(128).regex(VALID_TITLE_REGEX),
  expression: z.string().min(1).max(128),
  // buckets: z.array(z.number()).optional(),
});
export type AttributeColumn = z.infer<typeof AttributeColumn>;

// TODO: make the whole thing optional but not the individual fields
export const ColumnMapping = z.object({
  tableName: z.string().regex(VALID_TABLE_OR_COLUMN_REGEX).optional(),
  columns: z.record(z.string()),
  attributes: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(AttributeColumn).optional(),
  ),
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;
