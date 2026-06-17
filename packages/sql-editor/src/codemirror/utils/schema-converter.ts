import type {SQLNamespace} from '@codemirror/lang-sql';
import type {DataTable} from '@sqlrooms/duckdb';
import type {Completion} from '@codemirror/autocomplete';

type NamespaceRecord = {[name: string]: SQLNamespace};

function namespaceKey(name: string): string {
  return name.replace(/\./g, '\\.');
}

function isNamespaceRecord(
  value: SQLNamespace | undefined,
): value is NamespaceRecord {
  return (
    !Array.isArray(value) &&
    typeof value === 'object' &&
    value !== null &&
    !('self' in value)
  );
}

function isNamespaceWithRecordChildren(
  value: SQLNamespace | undefined,
): value is {self: Completion; children: NamespaceRecord} {
  return (
    !!value &&
    !Array.isArray(value) &&
    'children' in value &&
    isNamespaceRecord(value.children)
  );
}

function columnsNamespace(table: DataTable): readonly Completion[] {
  return table.columns.map((col) => ({
    label: col.name,
    type: 'property',
    detail: col.type,
    boost: 10,
  }));
}

function selfNamespace(
  label: string,
  type: Completion['type'],
  children: SQLNamespace,
  detail?: string,
  boost = 0,
): SQLNamespace {
  return {
    self: {
      label,
      type,
      detail,
      boost,
    },
    children,
  };
}

function getChildren(
  namespace: NamespaceRecord,
  name: string,
): NamespaceRecord {
  const key = namespaceKey(name);
  const existing = namespace[key];

  if (isNamespaceWithRecordChildren(existing)) {
    return existing.children;
  }

  const children: NamespaceRecord = isNamespaceRecord(existing) ? existing : {};

  namespace[key] = selfNamespace(name, 'namespace', children, undefined, 15);
  return children;
}

/** Converts SQLRooms DataTable[] to CodeMirror SQLNamespace format for autocompletion */
export function convertToSQLNamespace(tables: DataTable[]): SQLNamespace {
  const namespace: NamespaceRecord = {};

  for (const table of tables) {
    const tableName = table.table.table;
    const columns = columnsNamespace(table);
    const tableNamespace = selfNamespace(
      tableName,
      'type',
      columns,
      table.isView ? 'View' : 'Table',
      20,
    );

    namespace[namespaceKey(tableName)] = tableNamespace;

    if (table.table.schema) {
      getChildren(namespace, table.table.schema)[namespaceKey(tableName)] =
        tableNamespace;
    }

    if (table.table.database && table.table.schema) {
      const databaseNamespace = getChildren(namespace, table.table.database);
      getChildren(databaseNamespace, table.table.schema)[
        namespaceKey(tableName)
      ] = tableNamespace;
    }
  }

  return namespace;
}
