import type {SQLNamespace} from '@codemirror/lang-sql';
import type {Extension} from '@codemirror/state';
import {sqlExtension, NodeSqlParser} from '@marimo-team/codemirror-sql';
import type {DataTable} from '@sqlrooms/duckdb';
import {renderComponentToString} from '@sqlrooms/utils';
import {SqlTableTooltip} from '../../../components/SqlTableTooltip';
import {SqlColumnTooltip} from '../../../components/SqlColumnTooltip';

const LINT_DELAY_DEFAULT = 500;
const HOVER_DELAY_DEFAULT = 500;

export function createDuckDbSqlExtension(
  schema: SQLNamespace,
  tables: DataTable[],
): Extension {
  const duckdbParser = new NodeSqlParser({
    getParserOptions: () => ({
      database: 'DuckDB',
    }),
  });

  return sqlExtension({
    enableLinting: false,
    linterConfig: {
      parser: duckdbParser,
      delay: LINT_DELAY_DEFAULT,
    },
    enableGutterMarkers: false,
    gutterConfig: {
      parser: duckdbParser,
    },
    enableHover: true,
    hoverConfig: {
      schema: schema,
      hoverTime: HOVER_DELAY_DEFAULT,
      enableTables: true,
      enableColumns: true,
      tooltipRenderers: {
        table: (data) =>
          renderComponentToString(SqlTableTooltip, {data, tables}),
        column: (data) =>
          renderComponentToString(SqlColumnTooltip, {data, tables}),
      },
    },
  });
}
