import {
  createRagTool,
  type RagToolLlmResult,
  isPdfFile,
} from '@sqlrooms/ai-rag';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {useState, useRef} from 'react';
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      try {
        const state = roomStore.getState();
        await state.rag.initialize();
        // Initialize user_docs database schema if needed
        try {
          await state.rag.initializeEmptyDatabase('user_docs', 1536);
        } catch {
          // May already exist
        }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const state = roomStore.getState();
      let nodeIds: string[];

      if (isPdfFile(file)) {
        nodeIds = await state.rag.addPdfDocument(file, {
          database: 'user_docs',
        });
        setUploadStatus(
          `Added PDF "${file.name}" with ${nodeIds.length} chunks`,
        );
      } else {
        // Read as text
        const text = await file.text();
        nodeIds = await state.rag.addDocument(
          {
            text,
            fileName: file.name,
            metadata: {source: 'upload'},
          },
          {database: 'user_docs'},
        );
        setUploadStatus(`Added "${file.name}" with ${nodeIds.length} chunks`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(
        `Error: ${error instanceof Error ? error.message : 'Upload failed'}`,
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const state = roomStore.getState();
      const nodeIds = await state.rag.addDocument(
        {
          text: textContent,
          metadata: {source: 'paste'},
        },
        {database: 'user_docs'},
      );
      setUploadStatus(`Added text content with ${nodeIds.length} chunks`);
      setTextContent('');
    } catch (error) {
      console.error('Add text error:', error);
      setUploadStatus(
        `Error: ${error instanceof Error ? error.message : 'Failed to add text'}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>RAG Search & Documents</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="search" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="upload">Add Documents</TabsTrigger>
          </TabsList>

          <TabsContent
            value="search"
            className="flex min-h-0 flex-1 flex-col space-y-4"
          >
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
          </TabsContent>

          <TabsContent
            value="upload"
            className="flex min-h-0 flex-1 flex-col space-y-4"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Upload File (PDF, Markdown, Text)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.txt,.markdown"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900 dark:file:text-blue-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textContent">Or Paste Text Content</Label>
                <textarea
                  id="textContent"
                  className="h-40 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                  placeholder="Paste markdown or text content here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isUploading}
                />
                <Button
                  onClick={handleTextSubmit}
                  disabled={isUploading || !textContent.trim()}
                  className="w-full"
                >
                  {isUploading ? 'Adding...' : 'Add Text Content'}
                </Button>
              </div>

              {uploadStatus && (
                <div
                  className={`rounded p-3 text-sm ${
                    uploadStatus.startsWith('Error')
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  }`}
                >
                  {uploadStatus}
                </div>
              )}

              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <p className="font-semibold">Note:</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>Documents are stored in your browser (OPFS)</li>
                  <li>They persist across page refreshes</li>
                  <li>OpenAI API key must be configured in settings</li>
                  <li>Uploaded documents are searchable immediately</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
