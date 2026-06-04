import type {ChartDataPolicy} from '@sqlrooms/mosaic';
import {
  DEFAULT_DECK_MAP_MAX_DATA_POINTS,
  type DeckMapDashboardPanelConfig,
  type DeckMapDataPolicyOverride,
} from './dashboardConfig';

const DEFAULT_DECK_MAP_DATA_POLICY_REASON =
  'Map panels render source rows as interactive deck.gl features. Filter, aggregate, or switch to a smaller source query before rendering this map.';

function applyDeckMapDataPolicyOverride(
  basePolicy: ChartDataPolicy,
  override: DeckMapDataPolicyOverride | undefined,
): ChartDataPolicy {
  if (!override) {
    return basePolicy;
  }
  if (override.disabled) {
    return {
      ...basePolicy,
      disabled: true,
    };
  }
  return {
    ...basePolicy,
    ...(override.maxRows !== undefined ? {maxRows: override.maxRows} : {}),
    ...(override.reason !== undefined ? {reason: override.reason} : {}),
  };
}

export function getDeckMapDataPolicy(
  config: DeckMapDashboardPanelConfig | null | undefined,
): ChartDataPolicy {
  return applyDeckMapDataPolicyOverride(
    {
      maxRows: DEFAULT_DECK_MAP_MAX_DATA_POINTS,
      reason: DEFAULT_DECK_MAP_DATA_POLICY_REASON,
    },
    config?.dataPolicy,
  );
}
