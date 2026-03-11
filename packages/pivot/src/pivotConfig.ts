import {z} from 'zod';
import {
  DEFAULT_PIVOT_AGGREGATOR,
  getDefaultValuesForAggregator,
} from './aggregators';
import {
  PivotConfig,
  PivotField,
  PivotSliceConfig,
  PivotSortOrder,
  PivotStatus,
} from './types';

export function createDefaultPivotConfig(
  props?: Partial<PivotConfig>,
): PivotConfig {
  return PivotConfig.parse({
    aggregatorName: DEFAULT_PIVOT_AGGREGATOR,
    rendererName: 'Table',
    rows: [],
    cols: [],
    vals: [],
    valueFilter: {},
    rowOrder: PivotSortOrder.enum.key_a_to_z,
    colOrder: PivotSortOrder.enum.key_a_to_z,
    unusedOrder: [],
    menuLimit: 500,
    hiddenAttributes: [],
    hiddenFromAggregators: [],
    hiddenFromDragDrop: [],
    ...props,
  });
}

export function createDefaultPivotSliceConfig(props?: {
  pivotId?: string;
  title?: string;
  config?: Partial<PivotConfig>;
}): PivotSliceConfig {
  const pivotId = props?.pivotId ?? 'pivot-1';
  return PivotSliceConfig.parse({
    pivots: {
      [pivotId]: {
        id: pivotId,
        title: props?.title ?? 'Pivot 1',
        config: createDefaultPivotConfig(props?.config),
      },
    },
    order: [pivotId],
    currentPivotId: pivotId,
  });
}

export function createDefaultPivotStatus(): PivotStatus {
  return PivotStatus.parse({
    status: 'idle',
    stale: false,
  });
}

export function nextSortOrder(current: z.infer<typeof PivotSortOrder>) {
  switch (current) {
    case PivotSortOrder.enum.key_a_to_z:
      return PivotSortOrder.enum.value_a_to_z;
    case PivotSortOrder.enum.value_a_to_z:
      return PivotSortOrder.enum.value_z_to_a;
    default:
      return PivotSortOrder.enum.key_a_to_z;
  }
}

export function sanitizePivotConfigForFields(
  config: PivotConfig,
  fields: PivotField[],
): PivotConfig {
  const availableFields = new Set(fields.map((field) => field.name));
  const nextVals = getDefaultValuesForAggregator({
    aggregatorName: config.aggregatorName,
    fields: fields.filter(
      (field) => !config.hiddenFromAggregators.includes(field.name),
    ),
    currentValues: config.vals,
  });

  return PivotConfig.parse({
    ...config,
    rows: config.rows.filter((field) => availableFields.has(field)),
    cols: config.cols.filter((field) => availableFields.has(field)),
    vals: nextVals,
    unusedOrder: config.unusedOrder.filter((field) =>
      availableFields.has(field),
    ),
    valueFilter: Object.fromEntries(
      Object.entries(config.valueFilter).filter(([field]) =>
        availableFields.has(field),
      ),
    ),
  });
}

export function moveFieldInConfig(
  config: PivotConfig,
  field: string,
  destination: 'unused' | 'rows' | 'cols',
  index?: number,
): PivotConfig {
  const nextConfig = PivotConfig.parse({
    ...config,
    rows: config.rows.filter((value) => value !== field),
    cols: config.cols.filter((value) => value !== field),
    unusedOrder: config.unusedOrder.filter((value) => value !== field),
  });
  const target =
    destination === 'rows'
      ? nextConfig.rows
      : destination === 'cols'
        ? nextConfig.cols
        : nextConfig.unusedOrder;
  const targetIndex =
    index === undefined || index < 0 || index > target.length
      ? target.length
      : index;
  target.splice(targetIndex, 0, field);
  return nextConfig;
}

export function setAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
): PivotConfig {
  return PivotConfig.parse({
    ...config,
    valueFilter: {
      ...config.valueFilter,
      [attribute]: Object.fromEntries(values.map((value) => [value, true])),
    },
  });
}

export function addAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
): PivotConfig {
  const current = {...(config.valueFilter[attribute] ?? {})};
  for (const value of values) {
    current[value] = true;
  }
  return PivotConfig.parse({
    ...config,
    valueFilter: {
      ...config.valueFilter,
      [attribute]: current,
    },
  });
}

export function removeAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
): PivotConfig {
  const current = {...(config.valueFilter[attribute] ?? {})};
  for (const value of values) {
    delete current[value];
  }
  const nextValueFilter = {...config.valueFilter};
  if (Object.keys(current).length === 0) {
    delete nextValueFilter[attribute];
  } else {
    nextValueFilter[attribute] = current;
  }
  return PivotConfig.parse({
    ...config,
    valueFilter: nextValueFilter,
  });
}

export function clearAttributeFilterInConfig(
  config: PivotConfig,
  attribute: string,
): PivotConfig {
  const nextValueFilter = {...config.valueFilter};
  delete nextValueFilter[attribute];
  return PivotConfig.parse({
    ...config,
    valueFilter: nextValueFilter,
  });
}
