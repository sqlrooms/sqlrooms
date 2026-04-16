import type {Spec} from '@uwdata/mosaic-spec';
import {tool} from 'ai';
import {z} from 'zod';
import {createDefaultChartBuilders} from './builders';
import {buildChartTitleForSpec} from './chartSpecTitle';
import type {ChartBuilderColumn, ChartSpec} from './types';
import {toChartSpec} from './types';

export const DEFAULT_MOSAIC_CHART_TOOL_DESCRIPTION = `Create a Mosaic vgplot chart from a built-in template. Prefer this tool for common chart types (histogram, line chart, etc.) instead of writing raw vgplot JSON. Use set_dashboard_vgplot or equivalent only when no template fits.

Pass chartType as one of the template ids and fieldValues with keys matching each template's field keys (column names as values).`;

export type MosaicChartToolParameters = {
  chartType: string;
  fieldValues: Record<string, string>;
  reasoning: string;
};

export type MosaicChartToolOutput = {
  success: boolean;
  details: string;
  chartType?: string;
  title?: string;
  spec?: Spec;
  errorMessage?: string;
};

function columnMatchesFieldTypes(
  column: ChartBuilderColumn,
  field: {types?: string[]},
): boolean {
  if (!field.types?.length) return true;
  return field.types.some(
    (t) => column.type.toUpperCase() === t.toUpperCase(),
  );
}

function validateFieldValues(
  spec: ChartSpec,
  fieldValues: Record<string, string>,
  columns: ChartBuilderColumn[],
): string | null {
  for (const field of spec.fields) {
    const required = field.required !== false;
    const raw = fieldValues[field.key];
    if (required && (!raw || raw.trim() === '')) {
      return `Missing required field "${field.key}" (${field.label}).`;
    }
    if (!raw) continue;
    const col = columns.find((c) => c.name === raw);
    if (!col) {
      return `Unknown column "${raw}" for field "${field.key}". Use one of: ${columns.map((c) => c.name).join(', ') || '(none)'}.`;
    }
    if (!columnMatchesFieldTypes(col, field)) {
      return `Column "${raw}" has type ${col.type} but field "${field.key}" expects: ${field.types?.join(', ') ?? 'any'}.`;
    }
  }
  return null;
}

export type CreateMosaicChartToolOptions = {
  /** Templates to expose (defaults to all built-in templates, icons stripped). */
  specs?: ChartSpec[];
  tableName: string;
  columns: ChartBuilderColumn[];
  onCreateChart: (spec: Spec, title: string) => void;
  /** Tool description shown to the model */
  description?: string;
};

/**
 * AI SDK tool that creates a Mosaic spec from {@link ChartSpec} templates.
 *
 * @example
 * ```ts
 * tools: {
 *   create_mosaic_chart: createMosaicChartTool({
 *     tableName: 'sales',
 *     columns: [{name: 'amount', type: 'DOUBLE'}],
 *     onCreateChart: (spec, title) => store.addChart(spec, title),
 *   }),
 * },
 * ```
 */
export function createMosaicChartTool({
  specs: specsOption,
  tableName,
  columns,
  onCreateChart,
  description = DEFAULT_MOSAIC_CHART_TOOL_DESCRIPTION,
}: CreateMosaicChartToolOptions) {
  const specs: ChartSpec[] =
    specsOption && specsOption.length > 0
      ? specsOption
      : createDefaultChartBuilders().map(toChartSpec);

  if (specs.length === 0) {
    throw new Error('createMosaicChartTool: specs must be a non-empty array.');
  }

  const ids = specs.map((s) => s.id);
  const chartTypeEnum = z.enum(ids as [string, ...string[]]);

  const MosaicChartToolParametersSchema = z.object({
    chartType: chartTypeEnum.describe(
      `One of: ${ids.join(', ')}. See describeChartSpecs / system prompt for details.`,
    ),
    fieldValues: z
      .record(z.string(), z.string())
      .describe('Map of template field key -> selected column name.'),
    reasoning: z.string().describe('Brief rationale for this chart choice.'),
  });

  type In = z.infer<typeof MosaicChartToolParametersSchema>;

  return tool<In, MosaicChartToolOutput>({
    description,
    inputSchema: MosaicChartToolParametersSchema,
    execute: async (params) => {
      const {chartType, fieldValues} = params;
      const specDef = specs.find((s) => s.id === chartType);
      if (!specDef) {
        return {
          success: false,
          details: 'Unknown chartType.',
          errorMessage: `No template with id "${chartType}".`,
        };
      }

      const validationError = validateFieldValues(
        specDef,
        fieldValues,
        columns,
      );
      if (validationError) {
        return {
          success: false,
          details: validationError,
          errorMessage: validationError,
          chartType,
        };
      }

      try {
        const spec = specDef.createSpec(tableName, fieldValues);
        const title = buildChartTitleForSpec(specDef, fieldValues);
        onCreateChart(spec, title);
        return {
          success: true,
          details: `Created chart "${title}" from template "${chartType}".`,
          chartType,
          title,
          spec,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          details: message,
          errorMessage: message,
          chartType,
        };
      }
    },
  });
}
