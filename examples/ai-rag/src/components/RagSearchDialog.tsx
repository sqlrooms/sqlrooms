import {createRagTool, type RagToolLlmResult} from '@sqlrooms/ai-rag';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@sqlrooms/ui';
import {useState} from 'react';
import {roomStore} from '../store';

const ragTool = createRagTool();

/**
 * Individual result item - always visible, no collapsing
 */
function RagResultItem({
  result,
  index,
}: {
  result: {text: string; score: number; metadata?: Record<string, unknown>};
  index: number;
}) {
  const filePath = result.metadata?.file_path
    ? String(result.metadata.file_path)
    : null;

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Result #{index + 1}
          {filePath && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              📄 {filePath.split('/').pop()}
            </span>
          )}
        </span>
        <span className="text-muted-foreground/50 text-xs">
          Score: {result.score.toFixed(3)}
        </span>
      </div>
      <p className="text-muted-foreground whitespace-pre-wrap font-mono text-xs">
        {result.text}
      </p>
      {filePath && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          📄 {filePath}
        </div>
      )}
    </div>
  );
}

/**
 * Results display component
 */
function RagSearchResults({result}: {result: RagToolLlmResult}) {
  if (!result?.success) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
        <p className="text-xs font-semibold">RAG Search Failed</p>
        <p className="text-xs">{result?.error || 'Unknown error'}</p>
      </div>
    );
  }

  const {query, results, database} = result;

  return (
    <div className="space-y-3">
      <div className="rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">
          Search: "{query}"
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Database: {database} | Found {results?.length || 0} results
        </p>
      </div>

      <div className="space-y-2">
        {results &&
          results.map((result, i) => (
            <RagResultItem key={i} result={result} index={i} />
          ))}
      </div>
    </div>
  );
}

export function RagSearchDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<RagToolLlmResult | null>(null);

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      try {
        const state = roomStore.getState();
        await state.rag.initialize();
      } catch (error) {
        console.error('Failed to initialize RAG:', error);
      }
    } else {
      onClose();
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      const toolResult = await ragTool.execute({
        query,
        topK: 5,
      });

      setResult(toolResult.llmResult);
    } catch (error) {
      console.error('RAG search error:', error);
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Test RAG Search</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <div className="flex-shrink-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Search Query</Label>
              <div className="flex gap-2">
                <Input
                  id="query"
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <Button
                  className="h-full"
                  onClick={handleSearch}
                  disabled={isSearching || !query.trim()}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </div>

          {result && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <RagSearchResults result={result} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
