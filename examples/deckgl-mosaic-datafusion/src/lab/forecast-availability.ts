/**
 * Determines how many leading forecast steps are available. The store normally
 * publishes an ingestion-length coordinate, but older snapshots may leave that
 * coordinate entirely empty while the forecast chunks are still populated.
 */
export function availableLeadCount(
  leadHours: readonly number[],
  shapedLeadCount: number,
  ingestedSeconds: number,
  temperatureProbe?: ArrayLike<number>,
): number {
  const maximumLeadCount = Math.min(shapedLeadCount, leadHours.length);
  if (Number.isFinite(ingestedSeconds)) {
    const firstUnavailableLead = leadHours.findIndex(
      (hours) => hours * 3600 > ingestedSeconds,
    );
    return Math.min(
      maximumLeadCount,
      firstUnavailableLead < 0 ? leadHours.length : firstUnavailableLead,
    );
  }

  if (temperatureProbe === undefined) {
    return 0;
  }
  for (let index = 0; index < maximumLeadCount; index += 1) {
    if (!Number.isFinite(Number(temperatureProbe[index]))) {
      return index;
    }
  }
  return maximumLeadCount;
}
