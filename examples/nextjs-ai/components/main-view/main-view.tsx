'use client';
import {useScrollToBottom} from '@/hooks/use-scroll-to-bottom';
import {useProjectStore} from '@/store/demo-project-store';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from '@sqlrooms/ui';
import {KeyIcon, SquareTerminalIcon} from 'lucide-react';
import {EmptyMainView} from './empty-main-view';
import {ToolCall} from './tool-call';
import {Suspense} from 'react';

const MODEL_OPTIONS = [
  'gpt-4',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o3-mini-high',
] as const;

export const MainView: React.FC = () => {
  const isDataAvailable = useProjectStore((s) => s.isDataAvailable);
  const isRunningAnalysis = useProjectStore((s) => s.isRunningAnalysis);
  const runAnalysis = useProjectStore((s) => s.runAnalysis);
  const cancelAnalysis = useProjectStore((s) => s.cancelAnalysis);
  const analysisPrompt = useProjectStore((s) => s.analysisPrompt);
  const setAnalysisPrompt = useProjectStore((s) => s.setAnalysisPrompt);
  const openAiApiKey = useProjectStore((s) => s.openAiApiKey);
  const setOpenAiApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const aiModel = useProjectStore((s) => s.projectConfig.aiModel);
  const setAiModel = useProjectStore((s) => s.setAiModel);
  const analysisResults = useProjectStore(
    (s) => s.projectConfig.analysisResults,
  );
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  if (!isDataAvailable) {
    return <EmptyMainView />;
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex flex-col items-center justify-center gap-4 w-full p-4">
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="font-semibold text-lg pl-1">
            What would you like to learn about the data?
          </div>

          <div className="flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <KeyIcon className="w-4 h-4 absolute left-2 text-gray-400" />
                <Input
                  type="password"
                  placeholder="OpenAI API Key"
                  value={openAiApiKey || ''}
                  onChange={(e) => setOpenAiApiKey(e.target.value)}
                  className="pl-8 w-[150px] bg-gray-800"
                />
              </div>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger className="w-[140px] bg-gray-800">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="relative w-full">
          <Textarea
            disabled={isRunningAnalysis}
            className="h-[100px]  bg-gray-800"
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
          />
          <div className="absolute top-1 right-1 flex items-center gap-2">
            {isRunningAnalysis && (
              <Button variant="outline" onClick={() => cancelAnalysis()}>
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              onClick={runAnalysis}
              disabled={isRunningAnalysis || !openAiApiKey || !aiModel}
            >
              {isRunningAnalysis ? (
                <div className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" /> Running…
                </div>
              ) : (
                'Start Analysis'
              )}
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex flex-col w-full gap-4 p-4 overflow-auto"
      >
        {/* {analysisResults.length > 0 && (
          <div className="font-bold text-2xl">Data analysis log</div>
        )} */}
        {analysisResults.map((result) => (
          <div
            key={result.id}
            className="flex flex-col w-full text-sm border rounded-md"
          >
            <div className="bg-gray-700 p-6 mb-5 rounded-md text-gray-100 flex items-center gap-2">
              <SquareTerminalIcon className="w-4 h-4" />
              <div className="text-sm flex-1">{result.prompt}</div>
            </div>
            <div className="flex flex-col gap-5 px-4">
              {result.toolCalls.map((toolCall) => (
                <Suspense
                  key={toolCall.toolCallId}
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <Spinner className="w-4 h-4" />
                    </div>
                  }
                >
                  <ToolCall key={toolCall.toolCallId} toolCall={toolCall} />
                </Suspense>
              ))}
            </div>

            {/* {result.toolResults.map((toolResult) => (
              <pre
                key={toolResult.toolCallId}
                className="bg-gray-900 p-4 rounded-md text-gray-400 font-mono text-xs"
              >
                {JSON.stringify(toolResult, null, 2)}
              </pre>
            ))} */}
            <div
              ref={messagesEndRef}
              className="shrink-0 min-w-[24px] min-h-[24px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
