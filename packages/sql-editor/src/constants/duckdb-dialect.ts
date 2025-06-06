/**
 * DuckDB SQL language constants for Monaco Editor
 */

// DuckDB specific keywords
export const DUCKDB_KEYWORDS = [
  'PRAGMA',
  'RETURNING',
  'QUALIFY',
  'PIVOT',
  'UNPIVOT',
  'EXCLUDE',
  'INCLUDE',
  'WINDOW',
  'FILTER',
  'WITHIN',
  'OVER',
  'PARTITION',
  'RANGE',
  'ROWS',
  'GROUPS',
  'PRECEDING',
  'FOLLOWING',
  'CURRENT',
  'ROW',
  'TIES',
  'OTHERS',
  'EXCLUDE',
  'RESPECT',
  'NULLS',
  'FIRST',
  'LAST',
  'MATERIALIZED',
  'RECURSIVE',
  'TEMPORARY',
  'TEMP',
  'UNLOGGED',
  'GLOBAL',
  'LOCAL',
  'STORED',
  'VIRTUAL',
  'DELIMITED',
  'CSV',
  'JSON',
  'COPY',
  'DESCRIBE',
  'EXPLAIN',
  'SUMMARIZE',
  'PROFILE',
  'LOAD',
  'INSTALL',
  'FORCE',
  'PARALLEL',
  'SEQUENTIAL',
  'PRAGMA',
  // Standard SQL keywords
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP',
  'BY',
  'HAVING',
  'ORDER',
  'LIMIT',
  'OFFSET',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'CREATE',
  'ALTER',
  'DROP',
  'TABLE',
  'VIEW',
  'INDEX',
  'TRIGGER',
  'PROCEDURE',
  'FUNCTION',
  'DATABASE',
  'SCHEMA',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'NATURAL',
  'ON',
  'USING',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS',
  'IN',
  'BETWEEN',
  'LIKE',
  'AS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'DISTINCT',
  'ALL',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'WITH',
  'CAST',
  'PRIMARY',
  'KEY',
  'FOREIGN',
  'REFERENCES',
  'CONSTRAINT',
  'DEFAULT',
  'CHECK',
  'UNIQUE',
  'INDEX',
  'CASCADE',
  'RESTRICT',
  'ASC',
  'DESC',
  'IF',
  'EXISTS',
  'TRUE',
  'FALSE',
];

// DuckDB functions
export const DUCKDB_FUNCTIONS = [
  // Aggregate functions
  'ARRAY_AGG',
  'AVG',
  'BIT_AND',
  'BIT_OR',
  'BIT_XOR',
  'COUNT',
  'FIRST',
  'LAST',
  'LIST',
  'MAX',
  'MIN',
  'STRING_AGG',
  'SUM',
  'MEDIAN',
  'QUANTILE',
  'APPROX_COUNT_DISTINCT',
  'APPROX_QUANTILE',
  // Window functions
  'ROW_NUMBER',
  'RANK',
  'DENSE_RANK',
  'PERCENT_RANK',
  'CUME_DIST',
  'NTILE',
  'LAG',
  'LEAD',
  'FIRST_VALUE',
  'LAST_VALUE',
  'NTH_VALUE',
  // Date functions
  'AGE',
  'DATE_PART',
  'DATE_TRUNC',
  'EXTRACT',
  'GREATEST',
  'LEAST',
  'NOW',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_TIMESTAMP',
  'EPOCH',
  'STRFTIME',
  'STRPTIME',
  'TO_TIMESTAMP',
  // String functions
  'CONCAT',
  'LENGTH',
  'LOWER',
  'LPAD',
  'LTRIM',
  'REGEXP_MATCHES',
  'REGEXP_REPLACE',
  'REPEAT',
  'REPLACE',
  'REVERSE',
  'RIGHT',
  'RPAD',
  'RTRIM',
  'SPLIT',
  'SUBSTRING',
  'TRIM',
  'UPPER',
  // Nested functions
  'LIST_EXTRACT',
  'LIST_ELEMENT',
  'LIST_VALUE',
  'STRUCT_EXTRACT',
  'STRUCT_PACK',
  'MAP',
  'MAP_EXTRACT',
  // Math functions
  'ABS',
  'CEIL',
  'CEILING',
  'FLOOR',
  'ROUND',
  'SIGN',
  'SQRT',
  'CBRT',
  'EXP',
  'LN',
  'LOG',
  'POWER',
  'MOD',
  'RANDOM',
  'SETSEED',
  'ACOS',
  'ASIN',
  'ATAN',
  'ATAN2',
  'COS',
  'COT',
  'SIN',
  'TAN',
  'RADIANS',
  'DEGREES',
  'PI',
  // Other functions
  'COALESCE',
  'NULLIF',
  'TYPEOF',
  'CURRENT_SCHEMA',
  'CURRENT_USER',
  'HASH',
  'UUID',
  'CHAR_LENGTH',
  'CHARACTER_LENGTH',
  'POSITION',
  'OVERLAY',
  'CONCAT_WS',
  'FORMAT',
  'TO_CHAR',
  'TO_DATE',
  'TO_NUMBER',
  'LOCALTIME',
  'LOCALTIMESTAMP',
  'JUSTIFY_DAYS',
  'JUSTIFY_HOURS',
  'JUSTIFY_INTERVAL',
  'MAKE_DATE',
  'MAKE_INTERVAL',
  'MAKE_TIME',
  'MAKE_TIMESTAMP',
  'CLOCK_TIMESTAMP',
  'STATEMENT_TIMESTAMP',
  'TRANSACTION_TIMESTAMP',
];

// SQL operators
export const SQL_OPERATORS = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '=',
  '<>',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  '<<',
  '>>',
  '||',
  '::',
  '->>',
  '->',
  '~',
  '!',
  '@',
];

// SQL variables
export const SQL_VARIABLES = [
  '$1',
  '$2',
  '$3',
  '$4',
  '$5',
  '$6',
  '$7',
  '$8',
  '$9',
];

// SQL pseudo columns
export const SQL_PSEUDO_COLUMNS = [
  '$ACTION',
  '$IDENTITY',
  '$ROWGUID',
  '$PARTITION',
];

// SQL language configuration for Monaco Editor
export const SQL_LANGUAGE_CONFIGURATION = {
  defaultToken: '',
  tokenPostfix: '.sql',
  ignoreCase: true,

  brackets: [
    {open: '[', close: ']', token: 'delimiter.square'},
    {open: '(', close: ')', token: 'delimiter.parenthesis'},
  ],

  keywords: DUCKDB_KEYWORDS,
  operators: SQL_OPERATORS,
  builtinFunctions: DUCKDB_FUNCTIONS,
  builtinVariables: SQL_VARIABLES,
  pseudoColumns: SQL_PSEUDO_COLUMNS,

  tokenizer: {
    root: [
      {include: '@comments'},
      {include: '@whitespace'},
      {include: '@numbers'},
      {include: '@strings'},
      {include: '@complexIdentifiers'},
      {include: '@scopes'},
      [/[;,.]/, 'delimiter'],
      [/[()]/, '@brackets'],
      [
        /[\w@#$]+/,
        {
          cases: {
            '@keywords': 'keyword',
            '@operators': 'operator',
            '@builtinFunctions': 'predefined',
            '@builtinVariables': 'predefined',
            '@pseudoColumns': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
      [/[<>=!%&+\-*/|~^]/, 'operator'],
    ],
    whitespace: [[/\s+/, 'white']],
    comments: [
      [/--+.*/, 'comment'],
      [/\/\*/, {token: 'comment.quote', next: '@comment'}],
    ],
    comment: [
      [/[^*/]+/, 'comment'],
      [/\*\//, {token: 'comment.quote', next: '@pop'}],
      [/./, 'comment'],
    ],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
    ],
    strings: [
      [/'/, {token: 'string', next: '@string'}],
      [/"/, {token: 'string.double', next: '@stringDouble'}],
    ],
    string: [
      [/[^']+/, 'string'],
      [/''/, 'string'],
      [/'/, {token: 'string', next: '@pop'}],
    ],
    stringDouble: [
      [/[^"]+/, 'string.double'],
      [/""/, 'string.double'],
      [/"/, {token: 'string.double', next: '@pop'}],
    ],
    complexIdentifiers: [
      [/\[/, {token: 'identifier.quote', next: '@bracketedIdentifier'}],
      [/"/, {token: 'identifier.quote', next: '@quotedIdentifier'}],
    ],
    bracketedIdentifier: [
      [/[^\]]+/, 'identifier'],
      [/]]/, 'identifier'],
      [/]/, {token: 'identifier.quote', next: '@pop'}],
    ],
    quotedIdentifier: [
      [/[^"]+/, 'identifier'],
      [/""/, 'identifier'],
      [/"/, {token: 'identifier.quote', next: '@pop'}],
    ],
    scopes: [],
  },
};
