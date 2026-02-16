import {Button, Input} from '@sqlrooms/ui';
import {Key} from 'lucide-react';
import {useCallback, useRef, useEffect, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';

function formatProviderLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export type InlineApiKeyInputProps = {
  className?: string;
  onSaveApiKey: (provider: string, apiKey: string) => void;
};

/**
 * Inline API key input component for use within Chat.Composer.
 * When placed as a child of Chat.Composer, it will be rendered instead of
 * the prompt textarea when no API key is configured for the current provider.
 *
 * @example
 * ```tsx
 * <Chat.Composer>
 *   <Chat.InlineApiKeyInput
 *     onSaveApiKey={(provider, apiKey) => {
 *       updateProvider(provider, {apiKey});
 *     }}
 *   />
 *   <Chat.ModelSelector />
 * </Chat.Composer>
 * ```
 */
export const InlineApiKeyInput: React.FC<InlineApiKeyInputProps> = ({
  onSaveApiKey,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const modelProvider = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.modelProvider || 'openai',
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
          onSaveApiKey(modelProvider, apiKeyInput.trim());
          setApiKeyInput('');
        }
      }
    },
    [apiKeyInput, modelProvider, onSaveApiKey],
  );

  const handleSave = useCallback(() => {
    if (apiKeyInput.trim() && modelProvider) {
      onSaveApiKey(modelProvider, apiKeyInput.trim());
      setApiKeyInput('');
    }
  }, [apiKeyInput, modelProvider, onSaveApiKey]);

  const canSave = Boolean(apiKeyInput.trim().length && modelProvider);

  return (
    <>
      <Input
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
      <InlineApiKeyInputButton onSave={handleSave} disabled={!canSave} />
    </>
  );
};

/** Internal button component - rendered by QueryControls in the button slot */
export const InlineApiKeyInputButton: React.FC<{
  onSave: () => void;
  disabled: boolean;
}> = ({onSave, disabled}) => (
  <Button
    className="h-8 w-8 rounded-full"
    variant="default"
    size="icon"
    onClick={onSave}
    disabled={disabled}
    title="Save API key"
  >
    <Key className="h-4 w-4" />
  </Button>
);
