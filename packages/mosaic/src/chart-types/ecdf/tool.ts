import {tool} from 'ai';
import {z} from 'zod';
import {EcdfChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';

export const EcdfToolParameters = BaseChartToolParameters.extend({
  settings: EcdfChartSettings,
});

export type EcdfToolParams = z.infer<typeof EcdfToolParameters>;

export function createEcdfAiTool(deps: ChartToolDeps) {
  return tool({
    description:
      'Create an empirical cumulative distribution function (ECDF) plot.',
    inputSchema: EcdfToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

        // Validate settings
        if (params.settings.field) {
          deps.validateField(
            'field',
            params.settings.field,
            {
              required: true,
              types: ['DOUBLE', 'BIGINT', 'INTEGER', 'FLOAT'],
              label: 'Field',
            },
            columns,
          );
        }

        const title = `ECDF of ${params.settings.field}`;

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'ecdf',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created ECDF chart "${result.title}".`,
            data: result,
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
