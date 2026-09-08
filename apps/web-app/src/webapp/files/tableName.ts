export const BARE_TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function areWorkspaceTableNamesEqual(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export function findWorkspaceTableName(
  tableNames: string[],
  candidate: string,
) {
  return tableNames.find((tableName) =>
    areWorkspaceTableNamesEqual(tableName, candidate),
  );
}
