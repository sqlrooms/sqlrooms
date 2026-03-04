import type {SQLNamespace} from '@codemirror/lang-sql';
import type {Extension} from '@codemirror/state';
import {sqlExtension, NodeSqlParser} from '@marimo-team/codemirror-sql';

const LINT_DELAY_DEFAULT = 500;

export function createDuckDbSqlExtension(schema: SQLNamespace): Extension {
  const duckdbParser = new NodeSqlParser({
    getParserOptions: () => ({
      database: 'DuckDB',
    }),
  });

  return sqlExtension({
    enableLinting: true,
    linterConfig: {
      parser: duckdbParser,
      delay: LINT_DELAY_DEFAULT,
    },
    enableGutterMarkers: true,
    gutterConfig: {
      parser: duckdbParser,
    },
    enableHover: true,
    hoverConfig: {
      schema,
    },
  });
}
