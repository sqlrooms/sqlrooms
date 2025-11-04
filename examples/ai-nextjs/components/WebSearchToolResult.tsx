import {FC} from 'react';

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

const WebSearchToolResult: FC<{
  success: boolean;
  details: string;
  results?: WebSearchResult[];
}> = ({details, results}) => {
  return (
    <div className="border-muted rounded-md border bg-blue-500/10 p-3 text-sm">
      <div className="mb-2 font-semibold">🔍 {details}</div>
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, index) => (
            <div key={index} className="border-muted rounded border p-2">
              <div className="font-medium">{result.title}</div>
              <div className="text-muted-foreground text-xs">
                {result.snippet}
              </div>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs underline"
              >
                {result.url}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSearchToolResult;
