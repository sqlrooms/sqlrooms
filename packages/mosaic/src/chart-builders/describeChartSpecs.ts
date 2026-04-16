import type {ChartBuilderColumn, ChartBuilderField, ChartSpec} from './types';

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

function formatFieldsBlock(spec: ChartSpec): string {
  if (spec.fields.length === 0) {
    return '  Fields: none (template spec only; edit manually after creation)';
  }
  const lines = spec.fields.map((f) => {
    const req = f.required !== false ? 'required' : 'optional';
    return `    - ${f.key} (${f.label}): ${req}; ${formatFieldConstraints(f)}`;
  });
  return `  Fields:\n${lines.join('\n')}`;
}

/**
 * Serialize chart specs and column metadata into a string suitable for LLM
 * system prompts (e.g. alongside dashboard authoring instructions).
 */
export function describeChartSpecs(
  specs: ChartSpec[],
  tableName: string,
  columns: ChartBuilderColumn[],
): string {
  const header = `Available chart templates for table "${tableName}":`;
  const body = specs
    .map(
      (spec) =>
        `- ${spec.id}: ${spec.description}\n${formatFieldsBlock(spec)}`,
    )
    .join('\n');

  const colLine =
    columns.length > 0
      ? columns.map((c) => `${c.name} (${c.type})`).join(', ')
      : '(no columns provided)';

  return `${header}\n${body}\n\nAvailable columns: ${colLine}`;
}
