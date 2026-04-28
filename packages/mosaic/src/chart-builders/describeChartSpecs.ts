import type {
  ChartBuilderColumn,
  ChartBuilderField,
  ChartTypeDefinition,
} from './types';

function formatFieldConstraints(field: ChartBuilderField): string {
  const parts: string[] = [];
  if (field.types?.length) {
    parts.push(`columns typed ${field.types.join(' | ')}`);
  } else {
    parts.push('any column');
  }
  if (field.required === false) {
    parts.push('optional');
  }
  return parts.join(', ');
}

function formatFieldsBlock(chartType: ChartTypeDefinition): string {
  if (chartType.fields.length === 0) {
    return '  Fields: none (template spec only; edit manually after creation)';
  }
  const lines = chartType.fields.map((f) => {
    const req = f.required !== false ? 'required' : 'optional';
    const suffix = f.description ? `; ${f.description}` : '';
    return `    - ${f.key} (${f.label}): ${req}; ${formatFieldConstraints(f)}${suffix}`;
  });
  return `  Fields:\n${lines.join('\n')}`;
}

/**
 * Serialize chart types and column metadata into a string suitable for LLM
 * system prompts (e.g. alongside dashboard authoring instructions).
 */
export function describeChartTypes(
  chartTypes: ChartTypeDefinition[],
  tableName: string,
  columns: ChartBuilderColumn[],
): string {
  const header = `Available chart templates for table "${tableName}":`;
  const body = chartTypes
    .map(
      (chartType) =>
        `- ${chartType.id}: ${chartType.label ?? chartType.description}\n  Summary: ${chartType.aiDescription ?? chartType.description}\n${formatFieldsBlock(chartType)}`,
    )
    .join('\n');

  const colLine =
    columns.length > 0
      ? columns.map((c) => `${c.name} (${c.type})`).join(', ')
      : '(no columns provided)';

  return `${header}\n${body}\n\nAvailable columns: ${colLine}`;
}

/** Backward-compatible alias for earlier helper APIs. */
export const describeChartSpecs = describeChartTypes;
