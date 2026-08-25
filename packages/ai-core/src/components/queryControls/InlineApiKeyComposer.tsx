import {cn} from '@sqlrooms/ui';
import {
  useCallback,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {useBlockSends} from '../composer';
import {InlineApiKeyInputButton} from '../InlineApiKeyInput';
import {ComposerFooterStrip} from './ComposerFooterStrip';
import {useDelayedFocus} from './useDelayedFocus';
import type {InlineApiKeyInputElement} from './deprecatedChildren';

/** Capitalizes a provider key for display, special-casing OpenAI's casing. */
function formatProviderLabel(provider: string): string {
  return provider.toLowerCase() === 'openai'
    ? 'OpenAI'
    : provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * The composer's credential-entry mode: swaps the prompt textarea for a
 * password field that saves an API key for the selected provider.
 *
 * Rendered instead of the composer when a host passed `<InlineApiKeyInput>` as
 * a child and no usable key is stored yet.
 *
 * While mounted it blocks sends chat-wide, since the missing credential
 * applies to the whole chat and not just the textarea this replaces.
 */
export const InlineApiKeyComposer: FC<{
  className?: string;
  topRow?: ReactNode;
  inlineApiKeyInput: InlineApiKeyInputElement;
  children?: ReactNode;
}> = ({className, topRow, inlineApiKeyInput, children}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Use the resolved selection (not the current session's) so first-time key
  // entry works before any session exists: with lazy session creation there is
  // no current session yet, but a provider is still known from the default.
  const modelProvider = useStoreWithAi(
    (s) => s.ai.getSelectedModel().modelProvider,
  );
  const setApiKeyError = useStoreWithAi((s) => s.ai.setApiKeyError);

  const {onSaveApiKey} = inlineApiKeyInput.props;

  useDelayedFocus(inputRef);

  useBlockSends();

  const save = useCallback(() => {
    const key = apiKeyInput.trim();
    if (!key || !modelProvider) return;
    // Clear the API key error for this provider when saving a new key.
    setApiKeyError(modelProvider, false);
    onSaveApiKey(modelProvider, key);
    setApiKeyInput('');
  }, [apiKeyInput, modelProvider, onSaveApiKey, setApiKeyError]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      save();
    },
    [save],
  );

  const canSave = Boolean(apiKeyInput.trim().length && modelProvider);

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
        <div className="flex w-full flex-col gap-1 overflow-hidden">
          {topRow}
          <input
            ref={inputRef}
            type="password"
            className="min-h-[30px] flex-1 border-none bg-transparent p-2 text-sm outline-none focus-visible:ring-0"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modelProvider
                ? `Enter your ${formatProviderLabel(modelProvider)} API key...`
                : 'No model selected'
            }
            autoFocus
            autoComplete="off"
          />
          <ComposerFooterStrip
            actions={
              <div className="ml-auto shrink-0 gap-2 p-2">
                <InlineApiKeyInputButton onSave={save} disabled={!canSave} />
              </div>
            }
          >
            {children}
          </ComposerFooterStrip>
        </div>
      </div>
    </div>
  );
};
