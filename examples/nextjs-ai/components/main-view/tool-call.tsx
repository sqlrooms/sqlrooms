import {safeJsonParse} from '@/lib/utils';
import {ToolCallSchema} from '@/store/ai/schemas';
import {Badge, cn} from '@sqlrooms/ui';
import dynamic from 'next/dynamic';
import {useMemo} from 'react';

/** To avoid error during production Next.js build (ReferenceError: self is not defined) */
const Plot = dynamic(() => import('react-plotly.js'), {ssr: false});

interface ToolCallProps {
  toolCall: ToolCallSchema;
}

export function ToolCall({toolCall}: ToolCallProps) {
  const plotlyChartSpec = toolCall.args.plotlyChartSpec;
  const plotData = useMemo(
    () => safeJsonParse(plotlyChartSpec?.data),
    [plotlyChartSpec?.data],
  );

  const plotLayout = useMemo(
    () => safeJsonParse(plotlyChartSpec?.layout),
    [plotlyChartSpec?.layout],
  );

  return (
    <div
      key={toolCall.toolCallId}
      className={cn(
        'border-2 relative bg-gray-900 px-5 py-6 rounded-md text-gray-300 text-xs',
        {
          ' border-blue-500': toolCall.toolName === 'answer',
        },
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 text-gray-100',
          toolCall.toolName === 'answer' && 'bg-blue-500',
        )}
      >
        {toolCall.toolName}
      </Badge>
      {toolCall.toolName === 'query' ? (
        <div className="font-mono">{toolCall.args.sqlQuery}</div>
      ) : toolCall.toolName === 'answer' ? (
        <div className="flex flex-col gap-5">
          <div className="text-sm">{toolCall.args.answer}</div>
          {toolCall.args.plotlyChartSpec && plotData && plotLayout && (
            <div className="w-full flex">
              {Array.isArray(plotData) && (
                <Plot data={plotData} layout={plotLayout} />
              )}
            </div>
          )}
        </div>
      ) : (
        <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
      )}
    </div>
  );
}
