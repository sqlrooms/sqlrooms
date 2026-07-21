import type {ToolRenderer} from '@sqlrooms/ai-core';
import {VegaChartToolResult, type VegaChartToolOutput} from '@sqlrooms/vega';
import type {ExecuteApiOutput} from './executeApiTool';

/**
 * `executeApi` is a generic dispatcher, so most calls produce no visual output.
 * The dispatcher stamps `apiName` onto every output, so we switch on it to pick
 * the right view. Currently only `createChart` is renderable: it returns
 * `sqlQuery` + `vegaLiteSpec`, drawn with the same `VegaChartToolResult` used by
 * the top-level `chart` tool so skill-mode charts render identically.
 *
 * This renderer is registered under the `executeApi` tool name and hoisted (via
 * `Chat.Messages hoistedRenderers`) so a chart created inside a skill sub-agent
 * is promoted out of the nested activity log and rendered at the conversation
 * level.
 */
export const ExecuteApiToolRenderer: ToolRenderer<ExecuteApiOutput> = (
  props,
) => {
  const {output} = props;

  if (output?.apiName === 'createChart' && output.vegaLiteSpec) {
    return (
      <VegaChartToolResult
        {...props}
        output={{
          success: output.success,
          details: output.details ?? '',
          sqlQuery: output.sqlQuery ?? '',
          vegaLiteSpec:
            output.vegaLiteSpec as unknown as VegaChartToolOutput['vegaLiteSpec'],
        }}
        input={{
          sqlQuery: output.sqlQuery ?? '',
          vegaLiteSpec: JSON.stringify(output.vegaLiteSpec),
          reasoning: output.reasoning ?? '',
        }}
      />
    );
  }

  return null;
};
