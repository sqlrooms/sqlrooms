/**
 * Minimal Deck map config shape needed to inspect dataset sources.
 */
export type DeckMapDatasetSourceConfig = {
  datasets?: Record<string, unknown>;
};

/**
 * Returns the first dataset `source.tableName` found in a Deck map config.
 */
export function getFirstDatasetSourceTableName(
  config: DeckMapDatasetSourceConfig,
): string | undefined {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return undefined;
  }

  return Object.values(config.datasets)
    .map(
      (dataset) =>
        (dataset as Record<string, unknown>).source as
          | {tableName?: string}
          | undefined,
    )
    .find((source) => source?.tableName)?.tableName;
}

/**
 * Returns true when any dataset source is a literal `sqlQuery` without a
 * structured `tableName` (so selected-table switching cannot apply).
 */
export function hasSqlOnlyDatasetSource(
  config: DeckMapDatasetSourceConfig,
): boolean {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return false;
  }

  return Object.values(config.datasets).some((dataset) => {
    const source = (dataset as Record<string, unknown>).source as
      | {tableName?: string; sqlQuery?: string}
      | undefined;
    return Boolean(source?.sqlQuery && !source.tableName);
  });
}
