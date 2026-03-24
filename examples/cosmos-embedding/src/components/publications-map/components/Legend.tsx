import {FC} from 'react';
import {ScaleOrdinal, ScalePower} from 'd3-scale';

interface LegendProps {
  uniqueFields: string[];
  colorScale: ScaleOrdinal<string, string>;
  citationStats: {
    minCitations: number;
    maxCitations: number;
  } | null;
  sizeScale: ScalePower<number, number> | null;
}

export const Legend: FC<LegendProps> = ({
  uniqueFields,
  colorScale,
  citationStats,
  sizeScale,
}) => {
  return (
    <div className="absolute top-4 right-4 rounded-lg bg-gray-900/80 p-3 backdrop-blur-sm">
      <div className="mb-2 text-xs font-medium text-gray-300">Fields</div>
      <div className="flex flex-col gap-1.5">
        {uniqueFields.map((field) => (
          <div key={field} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-3 w-3 rounded-sm"
              style={{backgroundColor: colorScale(field)}}
            />
            <span className="text-gray-400">{field}</span>
          </div>
        ))}
      </div>
      {citationStats && sizeScale && (
        <>
          <div className="mt-4 mb-2 text-xs font-medium text-gray-300">
            Citations
          </div>
          <div className="flex flex-col gap-1.5">
            {sizeScale.ticks(4).map((citations: number) => (
              <div
                key={citations}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className="relative flex items-center justify-center"
                  style={{width: '20px', height: '20px'}}
                >
                  <span
                    className="bg-opacity-50 absolute rounded-full bg-white"
                    style={{
                      width: `${sizeScale(citations)}px`,
                      height: `${sizeScale(citations)}px`,
                      opacity: 0.8,
                    }}
                  />
                </span>
                <span className="text-gray-400">
                  {citations.toLocaleString()} citations
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
