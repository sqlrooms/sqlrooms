import {tool} from 'ai';
import {
  createDefaultChartTypes,
  createMosaicDashboardVgPlotPanelConfig,
  describeChartTypes,
  getAvailableChartTypes,
  type ChartBuilderColumn,
} from '@sqlrooms/mosaic';
import {z} from 'zod';
import type {RoomState} from './store';

const aiChartTypes = createDefaultChartTypes({includeCustomSpec: false});
const aiChartTypeIds = aiChartTypes.map((chartType) => chartType.id);

const DashboardChartTemplateToolParameters = z.object({
  sheetId: z
    .string()
    .optional()
    .describe(
      'Optional dashboard sheet ID. Defaults to the current dashboard sheet.',
    ),
  tableName: z
    .string()
    .optional()
    .describe(
      'Optional dashboard table name. Use this when no dashboard table is selected yet or when switching tables before adding the chart.',
    ),
  chartType: z
    .enum(aiChartTypeIds as [string, ...string[]])
    .describe(`One of: ${aiChartTypeIds.join(', ')}`),
  fieldValues: z
    .record(z.string(), z.string())
    .describe('Map of chart field key -> selected column name.'),
  createSheetIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true and no dashboard sheet exists, create one automatically.',
    ),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});

type DashboardChartTemplateToolParameters = z.infer<
  typeof DashboardChartTemplateToolParameters
>;

function getTablesWithColumns(state: RoomState) {
  return state.db.tables.filter(
    (table) => table.columns && table.columns.length > 0,
  );
}

function findTableColumns(
  state: RoomState,
  tableName: string,
): ChartBuilderColumn[] | null {
  const table = getTablesWithColumns(state).find(
    (candidate) => candidate.tableName === tableName,
  );
  if (!table?.columns) return null;
  return table.columns.map((column) => ({
    name: column.name,
    type: column.type,
  }));
}

function resolveDashboardSheetId(
  state: RoomState,
  params: Pick<
    DashboardChartTemplateToolParameters,
    'sheetId' | 'createSheetIfMissing'
  >,
): string | null {
  let targetSheetId =
    params.sheetId ?? state.dashboard.getCurrentDashboardSheetId();
  if (!targetSheetId && params.createSheetIfMissing) {
    targetSheetId = state.dashboard.createDashboardSheet();
  }
  if (!targetSheetId) return null;

  const sheet = state.cells.config.sheets[targetSheetId];
  if (!sheet || sheet.type !== 'dashboard') {
    throw new Error(`Sheet "${targetSheetId}" is not a dashboard sheet.`);
  }

  state.dashboard.ensureSheetDashboard(targetSheetId);
  return targetSheetId;
}

function resolveDashboardTable(
  state: RoomState,
  sheetId: string,
  tableName?: string,
): {tableName: string; columns: ChartBuilderColumn[]} {
  const tables = getTablesWithColumns(state);
  const dashboard = state.mosaicDashboard.getDashboard(sheetId);
  const explicitTableName = tableName?.trim() || undefined;

  if (explicitTableName) {
    const columns = findTableColumns(state, explicitTableName);
    if (!columns) {
      throw new Error(
        `Unknown table "${explicitTableName}". Available tables: ${tables.map((table) => table.tableName).join(', ') || '(none)'}.`,
      );
    }
    state.mosaicDashboard.setSelectedTable(sheetId, explicitTableName);
    return {tableName: explicitTableName, columns};
  }

  if (dashboard?.selectedTable) {
    const columns = findTableColumns(state, dashboard.selectedTable);
    if (columns) {
      return {tableName: dashboard.selectedTable, columns};
    }
  }

  if (tables.length === 1) {
    const onlyTable = tables[0];
    if (!onlyTable?.columns) {
      throw new Error('The only available table has no column metadata.');
    }
    state.mosaicDashboard.setSelectedTable(sheetId, onlyTable.tableName);
    return {
      tableName: onlyTable.tableName,
      columns: onlyTable.columns.map((column) => ({
        name: column.name,
        type: column.type,
      })),
    };
  }

  throw new Error(
    `No dashboard table is selected. Provide tableName using one of: ${tables.map((table) => table.tableName).join(', ') || '(none)'}.`,
  );
}

function validateFieldValues(
  fieldValues: Record<string, string>,
  chartTypeId: string,
  columns: ChartBuilderColumn[],
) {
  const chartType = aiChartTypes.find(
    (candidate) => candidate.id === chartTypeId,
  );
  if (!chartType) {
    throw new Error(`Unknown chart type "${chartTypeId}".`);
  }

  const availableChartTypes = getAvailableChartTypes([chartType], columns);
  if (availableChartTypes.length === 0) {
    throw new Error(
      `Chart type "${chartTypeId}" is not compatible with the selected table schema.`,
    );
  }

  for (const field of chartType.fields) {
    const value = fieldValues[field.key];
    if (field.required !== false && !value) {
      throw new Error(
        `Missing required field "${field.key}" (${field.label}).`,
      );
    }
    if (!value) continue;

    const column = columns.find((candidate) => candidate.name === value);
    if (!column) {
      throw new Error(
        `Unknown column "${value}" for field "${field.key}". Available columns: ${columns.map((candidate) => candidate.name).join(', ') || '(none)'}.`,
      );
    }

    if (
      field.types?.length &&
      !field.types.some(
        (type) => type.toUpperCase() === column.type.toUpperCase(),
      )
    ) {
      throw new Error(
        `Column "${value}" has type ${column.type} but field "${field.key}" expects ${field.types.join(', ')}.`,
      );
    }
  }

  return chartType;
}

export function getDashboardChartTemplateInstructions(store: {
  getState: () => RoomState;
}) {
  const state = store.getState();
  const currentSheetId = state.dashboard.getCurrentDashboardSheetId();
  const dashboard = currentSheetId
    ? state.mosaicDashboard.getDashboard(currentSheetId)
    : undefined;
  const tables = getTablesWithColumns(state);

  if (!dashboard?.selectedTable) {
    const tableNames = tables.map((table) => table.tableName).join(', ');
    return [
      'Simple dashboard charts:',
      '- Prefer `create_dashboard_chart_from_template` for common chart types such as histograms, line charts, heatmaps, box plots, and scatterplots.',
      '- Use `set_dashboard_vgplot` only when no template fits or when you need a more custom layout than the built-in chart templates provide.',
      `Available dashboard tables: ${tableNames || '(none)'}.`,
      'If no dashboard table is selected yet, pass `tableName` when calling `create_dashboard_chart_from_template`.',
      `Supported template ids: ${aiChartTypeIds.join(', ')}.`,
    ].join('\n');
  }

  const columns = findTableColumns(state, dashboard.selectedTable) ?? [];
  const availableChartTypes = getAvailableChartTypes(aiChartTypes, columns);

  return [
    'Simple dashboard charts:',
    '- Prefer `create_dashboard_chart_from_template` for common chart types such as histograms, line charts, heatmaps, box plots, and scatterplots.',
    '- Use `set_dashboard_vgplot` only when no template fits or when you need a more custom layout than the built-in chart templates provide.',
    `Current dashboard table: ${dashboard.selectedTable}.`,
    describeChartTypes(availableChartTypes, dashboard.selectedTable, columns),
  ].join('\n\n');
}

export function createDashboardChartTemplateTool(store: {
  getState: () => RoomState;
}) {
  return tool({
    description:
      'Create a dashboard chart from a built-in chart template. Prefer this for simple supported charts instead of writing full vgplot JSON.',
    inputSchema: DashboardChartTemplateToolParameters,
    execute: async (params: DashboardChartTemplateToolParameters) => {
      try {
        const state = store.getState();
        const targetSheetId = resolveDashboardSheetId(state, params);
        if (!targetSheetId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard sheet is available. Set createSheetIfMissing=true or create one first.',
            },
          };
        }

        const {tableName, columns} = resolveDashboardTable(
          state,
          targetSheetId,
          params.tableName,
        );
        const chartType = validateFieldValues(
          params.fieldValues,
          params.chartType,
          columns,
        );
        const spec = chartType.createSpec(tableName, params.fieldValues);
        const title = chartType.buildTitle
          ? chartType.buildTitle(params.fieldValues)
          : (chartType.label ?? chartType.description);
        const panel = createMosaicDashboardVgPlotPanelConfig(spec, title);

        state.mosaicDashboard.addPanel(targetSheetId, panel);
        state.cells.setCurrentSheet(targetSheetId);

        return {
          llmResult: {
            success: true,
            details: `Created dashboard chart "${title}" on sheet "${targetSheetId}".`,
            data: {
              panelId: panel.id,
              chartType: chartType.id,
              sheetId: targetSheetId,
              tableName,
              title,
            },
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}
