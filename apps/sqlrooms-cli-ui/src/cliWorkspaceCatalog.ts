/**
 * DuckDB catalog name for the CLI workspace database attachment.
 *
 * Dataset SQL often runs without this catalog in scope, so AI map prepare
 * should strip it from three-part `tableName` refs via `stripCatalogNames`.
 * Other apps must pass their own catalog names — do not hardcode this in
 * `@sqlrooms/deck`.
 */
export const CLI_WORKSPACE_CATALOG = 'sqlrooms-cli';
