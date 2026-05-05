import type {ComponentType} from 'react';
import type {
  ChartTypeDefinition,
  ChartBuilderField,
  ChartBuilderColumn,
} from '../chart-types/base-types';

// Re-export for backward compatibility
export type {ChartTypeDefinition, ChartBuilderField, ChartBuilderColumn};

/**
 * Describes a chart builder template that generates Mosaic JSON specs
 * (includes an icon for the chart-type grid).
 */
export interface ChartBuilderTemplate extends ChartTypeDefinition {
  /** Icon component */
  icon: ComponentType<{className?: string}>;
}

/**
 * Backward-compatible alias for earlier chart-builder helper APIs.
 * Prefer {@link ChartTypeDefinition} for new code.
 */
export type ChartSpec = ChartTypeDefinition;

/** Strip UI-only fields from a template for non-UI chart-type contexts. */
export function toChartTypeDefinition(
  template: ChartBuilderTemplate,
): ChartTypeDefinition {
  const {
    id,
    label,
    description,
    fields,
    createSpec,
    buildTitle,
    isAvailable,
    aiDescription,
  } = template;
  return {
    id,
    label,
    description,
    fields,
    createSpec,
    buildTitle,
    isAvailable,
    aiDescription,
  };
}

/** Backward-compatible alias for earlier helper APIs. */
export const toChartSpec = toChartTypeDefinition;
