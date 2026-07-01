import * as arrow from 'apache-arrow';

export type QualifiedTableName = {
  database?: string;
  schema?: string;
  table: string;
  /**
   * Database/catalog that can be omitted from the canonical table reference.
   */
  defaultDatabase?: string;
  /**
   * Returns raw, unescaped identifier parts in `[database, schema, table]`
   * order after applying any requested omissions.
   */
  toArray: (options?: {
    includeDatabase?: boolean;
    includeSchema?: boolean;
  }) => string[];
  /**
   * Returns a fully-qualified SQL table reference, including the database when
   * this object carries one.
   */
  toFullString: () => string;
  /**
   * Returns SQLRooms' canonical persisted table identity.
   *
   * Prefer the named boundary helpers instead of calling this directly:
   * `getTableIdentity(...)` for persisted ids and lookup keys,
   * `getRawSqlTableReference(...)` for direct SQL builders, and
   * `getTableDisplayName(...)` for UI labels.
   */
  toString: () => string;
};

declare const tableIdentityBrand: unique symbol;
declare const fullTableIdentityBrand: unique symbol;
declare const rawSqlTableReferenceBrand: unique symbol;

/**
 * Persisted SQLRooms table identity.
 *
 * This is the canonical `QualifiedTableName.toString()` shape. It may omit the
 * default database/catalog, so use it for persisted state, lookup keys, cache
 * keys, and selected-table state, not as an implicit SQL execution fragment.
 */
export type TableIdentity = string & {
  readonly [tableIdentityBrand]: 'TableIdentity';
};

/**
 * Fully-qualified SQLRooms table identity.
 *
 * Use this when diagnostics, migrations, or cross-catalog workflows need the
 * catalog/database to remain visible.
 */
export type FullTableIdentity = string & {
  readonly [fullTableIdentityBrand]: 'FullTableIdentity';
};

/**
 * SQL-rendered table reference for direct SQL string builders.
 *
 * This type is intentionally distinct from persisted identity strings. Construct
 * it from a resolved `QualifiedTableName` whenever possible.
 */
export type RawSqlTableReference = string & {
  readonly [rawSqlTableReferenceBrand]: 'RawSqlTableReference';
};

type QualifiedTableNameParts = Pick<
  QualifiedTableName,
  'database' | 'schema' | 'table' | 'defaultDatabase'
>;

export type ResolveTableReferenceResult<T> = {
  table?: T;
  ambiguousMatches?: T[];
};

type TableReferenceCandidate = {
  table: QualifiedTableName;
};

export function isQualifiedTableName(
  tableName: string | QualifiedTableName,
): tableName is QualifiedTableName {
  return typeof tableName === 'object' && 'toString' in tableName;
}

function qualifiedTableNameToFullString(tableName: QualifiedTableName): string {
  return (
    (tableName as {toFullString?: () => string}).toFullString?.() ??
    tableName.toString()
  );
}

function getCanonicalTableReference(
  tableName: Partial<QualifiedTableName>,
): string | undefined {
  if (!tableName.table) return undefined;
  return makeQualifiedTableName({
    database: tableName.database,
    schema: tableName.schema,
    table: tableName.table,
  }).toString();
}

/**
 * Builds a pure QualifiedTableName value from explicit identifier parts.
 * @param table - The name of the table.
 * @param schema - The schema of the table.
 * @param database - The database of the table.
 * @returns The qualified table name.
 *
 * @remarks
 * Prefer `state.db.qualifyTableName()` when a table reference should use the
 * current/default database context, and prefer `state.db.findTable()` when resolving
 * an existing table reference from user input or persisted table IDs.
 * Use this helper only when all qualification context is already known.
 */
export function makeQualifiedTableName({
  database,
  schema,
  table,
  defaultDatabase,
}: QualifiedTableNameParts): QualifiedTableName {
  const fullyQualifiedTableName = [database, schema, table]
    .filter((id) => id !== undefined && id !== null)
    .map((id) => escapeId(id))
    .join('.');
  const isDefaultDatabase =
    database !== undefined &&
    database !== null &&
    defaultDatabase !== undefined &&
    defaultDatabase !== null &&
    String(database) === String(defaultDatabase);
  const canonicalTableName = [
    database && !isDefaultDatabase ? database : undefined,
    schema,
    table,
  ]
    .filter((id) => id !== undefined && id !== null)
    .map((id) => escapeId(id))
    .join('.');
  return {
    database,
    schema,
    table,
    defaultDatabase,
    toArray: ({
      includeDatabase = true,
      includeSchema = true,
    }: {
      includeDatabase?: boolean;
      includeSchema?: boolean;
    } = {}) =>
      [
        includeDatabase ? database : undefined,
        includeSchema ? schema : undefined,
        table,
      ].filter((id): id is string => id !== undefined && id !== null),
    toFullString: () => fullyQualifiedTableName,
    toString: () => canonicalTableName,
  };
}

/**
 * Returns the canonical persisted SQLRooms table identity for a resolved table.
 *
 * Use this for saved state, lookup keys, cache keys, and selected-table state.
 * Rehydrate JSON/Zod/tool strings with `parseTableIdentity(...)` or resolve
 * them against the catalog before treating them as identities.
 */
export function getTableIdentity(table: QualifiedTableName): TableIdentity {
  return table.toString() as TableIdentity;
}

/**
 * Returns the fully-qualified SQLRooms table identity for a resolved table.
 *
 * Prefer `getTableIdentity(...)` for normal persisted state. Use this helper for
 * migrations, diagnostics, and workflows where the database/catalog cannot be
 * inferred from the default connection context.
 */
export function getFullTableIdentity(
  table: QualifiedTableName,
): FullTableIdentity {
  if (!table.database || !table.schema || !table.table) {
    throw new Error(
      'FullTableIdentity requires database, schema, and table parts.',
    );
  }
  const fullTableIdentity = table.toFullString();
  const parsedFullTableIdentity = parseFullTableIdentity(fullTableIdentity);
  if (!parsedFullTableIdentity) {
    throw new Error(
      `Invalid FullTableIdentity generated from qualified table "${fullTableIdentity}".`,
    );
  }
  return parsedFullTableIdentity;
}

function unquoteSqlIdentifierSegment(identifier: string): string {
  const segment = identifier.trim();
  if (segment.startsWith('"') && segment.endsWith('"') && segment.length >= 2) {
    return segment.slice(1, -1).split('""').join('"');
  }
  return segment;
}

function splitSqlIdentifierSegments(
  qualifiedName: string | undefined,
): string[] | undefined {
  if (!qualifiedName) return undefined;
  const input = qualifiedName.trim();
  if (!input) return undefined;

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (ch === '.' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }

    current += ch;
  }
  parts.push(current);

  if (inQuotes) {
    return undefined;
  }

  const identifiers = parts.map(unquoteSqlIdentifierSegment);

  if (
    identifiers.length === 0 ||
    identifiers.some((part) => part.length === 0)
  ) {
    return undefined;
  }
  return identifiers;
}

/**
 * Parses a possibly-qualified SQL identifier into database, schema, and table
 * segments. The parser is quote-aware, so dots inside double-quoted identifiers
 * are treated as part of the current segment.
 *
 * @example
 * parseQualifiedSqlIdentifier('schema.table')
 * // {schema: 'schema', table: 'table'}
 * parseQualifiedSqlIdentifier('"memory"."main"."events.2026"')
 * // {database: 'memory', schema: 'main', table: 'events.2026'}
 */
export function parseQualifiedSqlIdentifier(
  qualifiedName: string | undefined,
): Partial<QualifiedTableName> | undefined {
  const identifiers = splitSqlIdentifierSegments(qualifiedName);

  if (!identifiers || identifiers.length > 3) {
    return undefined;
  }

  if (identifiers.length === 3) {
    return {
      database: identifiers[0],
      schema: identifiers[1],
      table: identifiers[2],
    };
  }
  if (identifiers.length === 2) {
    return {schema: identifiers[0], table: identifiers[1]};
  }
  return {table: identifiers[0]};
}

/**
 * Rehydrates a persisted SQLRooms table identity string.
 *
 * This intentionally accepts only the canonical quoted representation produced
 * by `getTableIdentity(...)`. Legacy/user inputs such as `events` or
 * `main.events` should be resolved through `resolveTableReference(...)` first.
 */
export function parseTableIdentity(
  input: string | undefined,
): TableIdentity | undefined {
  const trimmedInput = input?.trim();
  if (!trimmedInput) return undefined;

  const parsed = parseQualifiedSqlIdentifier(trimmedInput);
  const canonical = parsed ? getCanonicalTableReference(parsed) : undefined;
  return canonical === trimmedInput ? (canonical as TableIdentity) : undefined;
}

/**
 * Rehydrates a persisted fully-qualified SQLRooms table identity string.
 *
 * The full identity must include database, schema, and table parts.
 */
export function parseFullTableIdentity(
  input: string | undefined,
): FullTableIdentity | undefined {
  const tableIdentity = parseTableIdentity(input);
  if (!tableIdentity) return undefined;
  const parsed = parseQualifiedSqlIdentifier(tableIdentity);
  return parsed?.database && parsed.schema
    ? (tableIdentity as string as FullTableIdentity)
    : undefined;
}

/**
 * Converts a rehydrated persisted table identity back to structured table parts.
 */
export function parseTableIdentityToQualifiedName(
  input: TableIdentity | FullTableIdentity,
): QualifiedTableName | undefined {
  const parsed = parseQualifiedSqlIdentifier(input);
  return parsed?.table
    ? makeQualifiedTableName({
        database: parsed.database,
        schema: parsed.schema,
        table: parsed.table,
      })
    : undefined;
}

/**
 * Returns the final identifier segment from a possibly-qualified SQL name.
 *
 * The parser is quote-aware: dots inside double-quoted identifiers are treated
 * as part of the identifier rather than as qualification separators. Embedded
 * quotes inside a quoted segment use the standard `""` escape.
 *
 * @example
 * getUnqualifiedSqlIdentifier('schema.table')              // 'table'
 * getUnqualifiedSqlIdentifier('db.schema.table')           // 'table'
 * getUnqualifiedSqlIdentifier('schema."my.funny.table"')   // 'my.funny.table'
 * getUnqualifiedSqlIdentifier('"weird""name"')             // 'weird"name'
 */
export function getUnqualifiedSqlIdentifier(
  qualifiedName: string | undefined,
): string | undefined {
  return splitSqlIdentifierSegments(qualifiedName)?.at(-1);
}

/**
 * Returns a SQL-rendered quoted table reference from a resolved table name.
 *
 * Use this at direct SQL string-builder boundaries. Persisted strings, command
 * inputs, AI tool arguments, and other plain strings should resolve to a
 * `QualifiedTableName` first, or use `quoteParsedRawSqlTableReference(...)` at
 * explicit legacy/user-input boundaries.
 */
export function getRawSqlTableReference(
  table: QualifiedTableName,
): RawSqlTableReference {
  return table.toString() as RawSqlTableReference;
}

/**
 * Parses and quotes a legacy/user-provided table reference for direct SQL.
 *
 * Prefer resolving against the catalog and calling `getRawSqlTableReference(...)`.
 * This helper exists for boundaries that still receive plain strings.
 */
export function quoteParsedRawSqlTableReference(
  input: string | undefined,
): RawSqlTableReference | undefined {
  const parsed = parseQualifiedSqlIdentifier(input);
  const canonical = parsed ? getCanonicalTableReference(parsed) : undefined;
  return canonical ? (canonical as RawSqlTableReference) : undefined;
}

/**
 * Quotes a table reference for SQL.
 *
 * Accepts bare names, unquoted qualified names, or already-quoted qualified
 * identifiers. Without a default database context, the result keeps all parsed
 * table reference parts and quotes each identifier segment.
 *
 * @example
 * quoteTableReference('events') // '"events"'
 * quoteTableReference('main.events') // '"main"."events"'
 * quoteTableReference('"memory"."main"."events.2026"') // '"memory"."main"."events.2026"'
 *
 * @deprecated Prefer `getRawSqlTableReference(...)` after resolving a
 * `QualifiedTableName`, or `quoteParsedRawSqlTableReference(...)` at explicit
 * legacy/user-input boundaries.
 */
export function quoteTableReference(tableName: string): string {
  const parsed = parseQualifiedSqlIdentifier(tableName);
  if (parsed?.table) {
    return makeQualifiedTableName({
      database: parsed.database,
      schema: parsed.schema,
      table: parsed.table,
    }).toString();
  }

  return escapeId(tableName);
}

/**
 * Returns a display-only label for a structured SQLRooms table name.
 *
 * Do not use this value for persistence, lookup, or SQL execution.
 */
export function getTableDisplayName(table: QualifiedTableName): string {
  return table.table;
}

function matchesQualifiedTableName<T extends TableReferenceCandidate>(
  candidate: T,
  tableName: Partial<QualifiedTableName>,
): boolean {
  return (
    candidate.table.table === tableName.table &&
    (!tableName.schema || candidate.table.schema === tableName.schema) &&
    (!tableName.database || candidate.table.database === tableName.database)
  );
}

/**
 * Resolves a table reference against an already-flat table catalog.
 *
 * Resolution prefers exact canonical table ids, then qualified SQL identifiers,
 * then unique bare table names. Ambiguous bare names are returned as matches
 * instead of silently selecting one table.
 *
 * @param tables - Flat catalog whose entries carry a QualifiedTableName.
 * @param tableReference - Table reference string or QualifiedTableName.
 * @returns Matching table, ambiguous matches, or an empty result.
 */
export function resolveTableReference<T extends TableReferenceCandidate>(
  tables: T[],
  tableReference: string | QualifiedTableName,
): ResolveTableReferenceResult<T> {
  if (typeof tableReference !== 'string') {
    const tableIdentity = getTableIdentity(tableReference);
    const fullTableIdentity = qualifiedTableNameToFullString(tableReference);
    return {
      table: tables.find(
        (candidate) =>
          getTableIdentity(candidate.table) === tableIdentity ||
          qualifiedTableNameToFullString(candidate.table) === fullTableIdentity,
      ),
    };
  }

  const trimmedTableReference = tableReference.trim();
  const canonicalMatches = tables.filter(
    (candidate) =>
      getTableIdentity(candidate.table) === trimmedTableReference ||
      qualifiedTableNameToFullString(candidate.table) === trimmedTableReference,
  );
  if (canonicalMatches.length === 1) return {table: canonicalMatches[0]};
  if (canonicalMatches.length > 1) {
    return {ambiguousMatches: canonicalMatches};
  }

  const parsedTableReference = parseQualifiedSqlIdentifier(
    trimmedTableReference,
  );
  if (
    parsedTableReference?.table &&
    (parsedTableReference.schema || parsedTableReference.database)
  ) {
    const qualifiedMatches = tables.filter((candidate) =>
      matchesQualifiedTableName(candidate, parsedTableReference),
    );
    if (qualifiedMatches.length === 1) return {table: qualifiedMatches[0]};
    if (qualifiedMatches.length > 1) {
      return {ambiguousMatches: qualifiedMatches};
    }
  }

  const bareMatches = tables.filter(
    (candidate) => candidate.table.table === trimmedTableReference,
  );
  if (bareMatches.length === 1) return {table: bareMatches[0]};
  if (bareMatches.length > 1) return {ambiguousMatches: bareMatches};

  return {};
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

/**
 * Result of separating the last SQL statement from preceding ones.
 */
export type SeparatedStatements = {
  /** All statements except the last one */
  precedingStatements: string[];
  /** The last statement */
  lastStatement: string;
};

/**
 * Separates a SQL query into preceding statements and the last statement.
 * Useful when you need to execute multiple statements but handle the last one differently
 * (e.g., wrap it in CREATE TABLE, add LIMIT, etc.).
 *
 * @param query - The SQL query string containing one or more statements
 * @returns Object containing preceding statements and the last statement
 * @throws Error if the query contains no statements
 */
export function separateLastStatement(query: string): SeparatedStatements {
  const statements = splitSqlStatements(query);
  if (statements.length === 0) {
    throw new Error('Query must contain at least one statement');
  }
  return {
    precedingStatements: statements.slice(0, -1),
    lastStatement: statements[statements.length - 1] as string,
  };
}

/**
 * Joins preceding statements with a (potentially modified) last statement into a single query.
 * @param precedingStatements - Statements to execute before the last one
 * @param lastStatement - The final statement (can be modified, e.g., wrapped in CREATE TABLE)
 * @returns A single query string with all statements joined by semicolons
 */
export function joinStatements(
  precedingStatements: string[],
  lastStatement: string,
): string {
  return precedingStatements.length > 0
    ? [...precedingStatements, lastStatement].join(';\n')
    : lastStatement;
}
