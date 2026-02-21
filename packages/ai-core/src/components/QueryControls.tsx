import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {
  PropsWithChildren,
  useCallback,
  useRef,
  useEffect,
  useState,
  Children,
  isValidElement,
  ReactNode,
} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {InlineApiKeyInput, InlineApiKeyInputButton} from './InlineApiKeyInput';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  onRun?: () => void;
  onCancel?: () => void;
}>;

/**
 * Checks if a child is an InlineApiKeyInput component
 */
function isInlineApiKeyInput(
  child: ReactNode,
): child is React.ReactElement<React.ComponentProps<typeof InlineApiKeyInput>> {
  return isValidElement(child) && child.type === InlineApiKeyInput;
}

/**
 * Extracts InlineApiKeyInput from children and returns the rest
 */
function extractInlineApiKeyInput(children: ReactNode): {
  inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  > | null;
  otherChildren: ReactNode[];
} {
  let inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  > | null = null;
  const otherChildren: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isInlineApiKeyInput(child)) {
      inlineApiKeyInput = child;
    } else {
      otherChildren.push(child);
    }
  });

  return {inlineApiKeyInput, otherChildren};
}

export const QueryControls: React.FC<QueryControlsProps> = ({
  className,
  placeholder = 'What would you like to learn about the data?',
  children,
  onRun,
  onCancel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;
  const model = currentSession?.model;

  const apiKey = useStoreWithAi((s) => s.ai.getApiKeyFromSettings());
  const hasApiKeyError = useStoreWithAi((s) => s.ai.hasApiKeyError());

  // Extract InlineApiKeyInput from children
  const {inlineApiKeyInput, otherChildren} = extractInlineApiKeyInput(children);

  // Show API key input if InlineApiKeyInput is provided and either:
  // - No API key is set, OR
  // - There's an API key error (invalid key)
  const showApiKeyInput =
    inlineApiKeyInput !== null &&
    (!apiKey || apiKey.trim().length === 0 || hasApiKeyError);

  const isRunning = useStoreWithAi((s) =>
    sessionId ? s.ai.getIsRunning(sessionId) : false,
  );
  const prompt = useStoreWithAi((s) =>
    sessionId ? s.ai.getPrompt(sessionId) : '',
  );
  const setPrompt = useStoreWithAi((s) => s.ai.setPrompt);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);

  useEffect(() => {
    if (showApiKeyInput) return;
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, [showApiKeyInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (!isRunning && sessionId && model && prompt.trim().length) {
          runAnalysis(sessionId);
        }
      }
    },
    [isRunning, sessionId, model, prompt, runAnalysis],
  );

  const canStart = Boolean(sessionId && model && prompt.trim().length);

  const handleClickRunOrCancel = useCallback(() => {
    if (!sessionId) return;
    if (isRunning) {
      cancelAnalysis(sessionId);
      onCancel?.();
    } else {
      runAnalysis(sessionId);
      onRun?.();
    }
  }, [sessionId, isRunning, cancelAnalysis, onCancel, runAnalysis, onRun]);

  // Render the API key input mode
  if (showApiKeyInput && inlineApiKeyInput) {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2',
          className,
        )}
      >
        <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
          <div className="flex w-full flex-col gap-1 overflow-hidden">
            {/* Render the InlineApiKeyInput which provides Input + Button */}
            <InlineApiKeyInputRenderer inlineApiKeyInput={inlineApiKeyInput}>
              {otherChildren}
            </InlineApiKeyInputRenderer>
          </div>
        </div>
      </div>
    );
  }

  // Render the normal prompt mode
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
        <div className="flex w-full flex-col gap-1 overflow-hidden">
          <Textarea
            ref={textareaRef}
            className="max-h-[min(300px,40vh)] min-h-[30px] resize-none border-none p-2 text-sm outline-hidden focus-visible:ring-0"
            autoResize
            value={prompt}
            onChange={(e) => {
              if (sessionId) {
                setPrompt(sessionId, e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
            <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
                  {otherChildren}
                </div>
              </div>
              <div className="ml-auto shrink-0 gap-2 p-2">
                <Button
                  className="h-8 w-8 rounded-full"
                  variant="default"
                  size="icon"
                  onClick={handleClickRunOrCancel}
                  disabled={!isRunning && !canStart}
                >
                  {isRunning ? <OctagonXIcon /> : <ArrowUpIcon />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Internal component that renders the InlineApiKeyInput with proper layout
 */
const InlineApiKeyInputRenderer: React.FC<{
  inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  >;
  children: ReactNode;
}> = ({inlineApiKeyInput, children}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const modelProvider = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.modelProvider || 'openai',
  );
  const setApiKeyError = useStoreWithAi((s) => s.ai.setApiKeyError);

  const {onSaveApiKey} = inlineApiKeyInput.props;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSaveKey = useCallback(
    (provider: string, apiKey: string) => {
      // Clear the API key error for this provider when saving a new key
      setApiKeyError(provider, false);
      onSaveApiKey(provider, apiKey);
    },
    [onSaveApiKey, setApiKeyError],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (apiKeyInput.trim() && modelProvider) {
          handleSaveKey(modelProvider, apiKeyInput.trim());
          setApiKeyInput('');
        }
      }
    },
    [apiKeyInput, modelProvider, handleSaveKey],
  );

  const handleSave = useCallback(() => {
    if (apiKeyInput.trim() && modelProvider) {
      handleSaveKey(modelProvider, apiKeyInput.trim());
      setApiKeyInput('');
    }
  }, [apiKeyInput, modelProvider, handleSaveKey]);

  const canSave = Boolean(apiKeyInput.trim().length && modelProvider);

  const formatProviderLabel = (provider: string) =>
    provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <>
      <input
        ref={inputRef}
        type="password"
        className="min-h-[30px] flex-1 border-none bg-transparent p-2 text-sm outline-none focus-visible:ring-0"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Enter your ${formatProviderLabel(modelProvider)} API key...`}
        autoFocus
        autoComplete="off"
      />
      <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
        <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
              {children}
            </div>
          </div>
          <div className="ml-auto shrink-0 gap-2 p-2">
            <InlineApiKeyInputButton onSave={handleSave} disabled={!canSave} />
          </div>
        </div>
      </div>
    </>
  );
};
