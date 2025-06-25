import * as arrow from 'apache-arrow';

export type QualifiedTableName = {
  database?: string;
  schema?: string;
  table: string;
  toString: () => string;
};

export function isQualifiedTableName(
  tableName: string | QualifiedTableName,
): tableName is QualifiedTableName {
  return typeof tableName === 'object' && 'toString' in tableName;
}

/**
 * Get a qualified table name from a table name, schema, and database.
 * @param table - The name of the table.
 * @param schema - The schema of the table.
 * @param database - The database of the table.
 * @returns The qualified table name.
 */
export function makeQualifiedTableName({
  database,
  schema,
  table,
}: QualifiedTableName) {
  const qualifiedTableName = [database, schema, table]
    .filter((id) => id !== undefined && id !== null)
    .map((id) => escapeId(id))
    .join('.');
  return {
    database,
    schema,
    table,
    toString: () => qualifiedTableName,
  };
}

/**
 * Escapes a value for use in DuckDB SQL queries by wrapping it in single quotes
 * and escaping any existing single quotes by doubling them.
 *
 * @param val - The value to escape. Will be converted to string if not already a string.
 * @returns The escaped string value wrapped in single quotes.
 * @example
 * escapeVal("John's data") // Returns "'John''s data'"
 */
export const escapeVal = (val: unknown) => {
  return `'${String(val).replace(/'/g, "''")}'`;
};

/**
 * Escapes an identifier (like table or column names) for use in DuckDB SQL queries
 * by wrapping it in double quotes and escaping any existing double quotes by doubling them.
 * If the identifier is already properly quoted, returns it as is.
 *
 * @param id - The identifier string to escape
 * @returns The escaped identifier wrapped in double quotes
 * @example
 * escapeId("my_table") // Returns '"my_table"'
 * escapeId("my""table") // Returns '"my""""table"'
 */
export const escapeId = (id: string) => {
  const str = String(id);
  if (str.startsWith('"') && str.endsWith('"')) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Checks if a DuckDB type string represents a numeric type.
 * Includes INTEGER, DECIMAL, FLOAT, REAL, and DOUBLE types.
 *
 * @param type - The DuckDB type string to check
 * @returns True if the type is numeric, false otherwise
 * @example
 * isNumericDuckType('INTEGER') // Returns true
 * isNumericDuckType('VARCHAR') // Returns false
 */
export const isNumericDuckType = (type: string) =>
  type.indexOf('INT') >= 0 ||
  type.indexOf('DECIMAL') >= 0 ||
  type.indexOf('FLOAT') >= 0 ||
  type.indexOf('REAL') >= 0 ||
  type.indexOf('DOUBLE') >= 0;

/**
 * Extracts a numeric value from an Arrow Table at the specified column and row index.
 * Handles both column name and index-based access. Converts BigInt values to numbers.
 *
 * @param res - The Arrow Table containing the data
 * @param column - The column name or index (0-based) to read from. Defaults to first column (0)
 * @param index - The row index (0-based) to read from. Defaults to first row (0)
 * @returns The numeric value at the specified position, or NaN if the value is null/undefined
 * @example
 * const value = getColValAsNumber(table, "amount", 0)
 */
export function getColValAsNumber(
  res: arrow.Table,
  column: string | number = 0,
  index = 0,
): number {
  const v = (
    typeof column === 'number' ? res.getChildAt(column) : res.getChild(column)
  )?.get(index);
  if (v === undefined || v === null) {
    return NaN;
  }
  // if it's an array (can be returned by duckdb as bigint)
  return Number(v[0] ?? v);
}

/**
 * Function given a query and position finds the line and column of the console.error();
 *
 * @param query - The query to parse
 * @param position - The position of the error
 * @returns The line and column of the error
 */
export const getSqlErrorWithPointer = (query: string, position: number) => {
  // Clamp position to be within the string bounds
  const safePos = Math.max(0, Math.min(position, query.length));
  // Get the substring up to the error position
  const upToPos = query.slice(0, safePos);
  // Split by newlines
  const lines = upToPos.split('\n');
  const line = lines.length; // 1-based
  // Defensive: lines[lines.length - 1] is always defined, but add fallback for linter
  const lastLine = lines[lines.length - 1] ?? '';
  const column = lastLine.length + 1; // 1-based

  // Get the full line text from the original query
  const queryLines = query.split('\n');
  const lineText = queryLines[line - 1] ?? '';
  // Pointer line: spaces up to column-1, then ^
  const pointerLine = ' '.repeat(Math.max(0, column - 1)) + '^';

  // Formatted output as requested
  const formatted = `LINE ${line}: ${lineText}\n${' '.repeat(`LINE ${line}: `.length)}${pointerLine}`;

  return {line, column, lineText, pointerLine, formatted};
};

//
// const queries = splitSqlStatements(`
//   SELECT * FROM users WHERE name = 'John;Doe';
//   SELECT * FROM orders -- This comment; won't break;
//   /*
//      Multi-line comment;
//      With semicolons;
//   */
//   SELECT "Quoted;identifier" FROM table;
//`);

// Returns:
// [
//   "SELECT * FROM users WHERE name = 'John;Doe'",
//   "SELECT * FROM orders -- This comment; won't break",
//   "SELECT \"Quoted;identifier\" FROM table"
// ]

/**
 * Split a string with potentially multiple SQL queries (separated as usual by ';')
 * into an array of queries.
 * This implementation:
 *  - Handles single and double quoted strings with proper escaping
 *  - Removes all comments: line comments (--) and block comments (/* ... *\/)
 *  - Ignores semicolons in quoted strings and comments
 *  - Trims whitespace from queries
 *  - Handles SQL-style escaped quotes ('' inside strings)
 *  - Returns only non-empty queries
 *
 * @param input - The SQL string containing one or more statements
 * @returns An array of SQL statements with all comments removed
 */
export function splitSqlStatements(input: string): string[] {
  const queries: string[] = [];
  let currentQuery = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        currentQuery += char; // preserve newlines for line numbers
      }
      // else: skip comment chars
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && input[i + 1] === '/') {
        inBlockComment = false;
        i++; // skip '/'
      }
      // else: skip comment chars
      continue;
    }

    if (inSingleQuote) {
      currentQuery += char;
      if (char === "'") {
        // Handle escaped single quotes in SQL
        if (i + 1 < input.length && input[i + 1] === "'") {
          currentQuery += input[++i];
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      currentQuery += char;
      if (char === '"') {
        // Handle escaped double quotes
        if (i + 1 < input.length && input[i + 1] === '"') {
          currentQuery += input[++i];
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    // Check for comment starts
    if (char === '-' && input[i + 1] === '-') {
      inLineComment = true;
      i++; // skip next '-'
      continue;
    }

    if (char === '/' && input[i + 1] === '*') {
      inBlockComment = true;
      i++; // skip next '*'
      continue;
    }

    // Check for quote starts
    if (char === "'") {
      inSingleQuote = true;
      currentQuery += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      currentQuery += char;
      continue;
    }

    // Handle query separator
    if (char === ';') {
      const trimmed = currentQuery.trim();
      if (trimmed.length > 0) {
        queries.push(trimmed);
      }
      currentQuery = '';
      continue;
    }

    currentQuery += char;
  }

  // Add the final query
  const trimmed = currentQuery.trim();
  if (trimmed.length > 0) {
    queries.push(trimmed);
  }

  return queries;
}

/**
 * Sanitizes a SQL query by removing trailing semicolons, comments, and normalizing whitespace
 */
export function sanitizeQuery(query: string): string {
  return query
    .trim() // Remove leading/trailing whitespace
    .replace(/;+$/, '') // Remove all trailing semicolons
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' '); // Normalize whitespace to single spaces
}

/**
 * Make a limit query from a query and a limit.
 * @param query - The SELECT query to make limited.
 * @param options - The options for the limit query.
 * @param options.limit - The number of rows to limit the query to.
 * @param options.offset - The number of rows to offset the query by.
 * @param options.sanitize - Whether to sanitize the query.
 * @returns The limited query.
 */
export function makeLimitQuery(
  query: string,
  {
    limit = 100,
    offset = 0,
    sanitize = true,
  }: {
    limit?: number;
    offset?: number;
    sanitize?: boolean;
  } = {},
) {
  return `SELECT * FROM (
    ${sanitize ? sanitizeQuery(query) : query}
  ) LIMIT ${limit} OFFSET ${offset}`;
}
