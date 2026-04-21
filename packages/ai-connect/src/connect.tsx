import React from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {KeyRound, LinkIcon, LogOut, PlugZap, RefreshCw} from 'lucide-react';
import {useStoreWithAiSettings} from '@sqlrooms/ai-settings';
import {useStoreWithAiConnect} from './AiConnectSlice';
import type {AiProviderAuthInstructions} from './types';

function humanizeProviderTitle(providerId: string, title?: string): string {
  if (title?.trim()) return title;
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

function StepBody(props: {instructions: AiProviderAuthInstructions | null}) {
  const {
    step,
    apiKeyDraft,
    codeDraft,
    error,
    pending,
    setApiKeyDraft,
    setCodeDraft,
    submitApiKey,
    submitCode,
    refreshProviderStatus,
  } = useStoreWithAiConnect((s) => s.aiConnect);

  if (step === 'enter_api_key') {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ai-connect-api-key">API key</Label>
          <Input
            id="ai-connect-api-key"
            type="password"
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            placeholder="Paste your provider API key"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            onClick={() => void submitApiKey(apiKeyDraft)}
            disabled={pending || !apiKeyDraft.trim()}
          >
            {pending ? 'Saving…' : 'Save key'}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === 'enter_code') {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ai-connect-code">Authorization code</Label>
          <Input
            id="ai-connect-code"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            placeholder={
              props.instructions?.codeFormatHint || 'Paste the code here'
            }
          />
        </div>
        {props.instructions?.url && (
          <a
            className="text-primary inline-flex items-center gap-2 text-sm underline"
            href={props.instructions.url}
            target="_blank"
            rel="noreferrer"
          >
            <LinkIcon className="h-4 w-4" />
            Open authorization page
          </a>
        )}
        {props.instructions?.instructions && (
          <p className="text-muted-foreground text-sm">
            {props.instructions.instructions}
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            onClick={() => void submitCode(codeDraft)}
            disabled={pending || !codeDraft.trim()}
          >
            {pending ? 'Submitting…' : 'Submit code'}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === 'oauth_wait' || step === 'device_code') {
    return (
      <div className="space-y-3">
        {props.instructions?.url && (
          <a
            className="text-primary inline-flex items-center gap-2 text-sm underline"
            href={props.instructions.url}
            target="_blank"
            rel="noreferrer"
          >
            <LinkIcon className="h-4 w-4" />
            Open authorization page
          </a>
        )}
        {props.instructions?.userCode && (
          <div className="space-y-1">
            <Label>User code</Label>
            <Input value={props.instructions.userCode} readOnly />
          </div>
        )}
        {props.instructions?.instructions && (
          <p className="text-muted-foreground text-sm">
            {props.instructions.instructions}
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => void refreshProviderStatus()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh status
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <Alert>
        <AlertDescription>Provider connected successfully.</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function AiConnectDialog(_props: {apiBaseUrl?: string}) {
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const {
    dialogOpen,
    currentProviderId,
    currentMethodId,
    closeConnect,
    selectProvider,
    selectMethod,
    startAuth,
    step,
    instructions,
  } = useStoreWithAiConnect((s) => s.aiConnect);

  const provider = currentProviderId ? providers[currentProviderId] : undefined;
  const methods = provider?.authMethods || [];
  const canStart = Boolean(currentProviderId && currentMethodId);

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeConnect()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a provider</DialogTitle>
          <DialogDescription>
            Choose a provider and authentication method for the assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select
              value={currentProviderId}
              onValueChange={(value) => selectProvider(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(providers).map(([providerId, providerInfo]) => (
                  <SelectItem key={providerId} value={providerId}>
                    {humanizeProviderTitle(providerId, providerInfo.title)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider && (
            <div className="space-y-1">
              <Label>Authentication method</Label>
              <Select
                value={currentMethodId}
                onValueChange={(value) => selectMethod(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an auth method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentMethodId && (
                <div className="flex items-center gap-2 pt-1">
                  {methods
                    .filter((method) => method.id === currentMethodId)
                    .map((method) => (
                      <React.Fragment key={method.id}>
                        {method.experimental && (
                          <Badge variant="secondary">Experimental</Badge>
                        )}
                        {method.description && (
                          <p className="text-muted-foreground text-xs">
                            {method.description}
                          </p>
                        )}
                      </React.Fragment>
                    ))}
                </div>
              )}
            </div>
          )}

          {(step === 'pick_method' || step === 'pick_provider') && (
            <DialogFooter>
              <Button onClick={() => void startAuth()} disabled={!canStart}>
                Continue
              </Button>
            </DialogFooter>
          )}

          {step !== 'pick_method' && step !== 'pick_provider' && (
            <StepBody instructions={instructions} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AiProviderConnectButton(props: {
  providerId?: string;
  apiBaseUrl?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
}) {
  const openConnect = useStoreWithAiConnect((s) => s.aiConnect.openConnect);

  return (
    <Button
      variant={props.variant || 'secondary'}
      size={props.size || 'sm'}
      className={props.className}
      onClick={() => openConnect(props.providerId)}
    >
      <PlugZap className="mr-2 h-4 w-4" />
      Connect provider
    </Button>
  );
}

export function AiProviderStatusList(_props: {apiBaseUrl?: string}) {
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const logout = useStoreWithAiConnect((s) => s.aiConnect.logout);
  const openConnect = useStoreWithAiConnect((s) => s.aiConnect.openConnect);

  return (
    <div className="space-y-3">
      {Object.entries(providers).map(([providerId, provider]) => {
        const status = provider.status;
        const hasCredentials = Boolean(status?.hasCredentials);
        return (
          <div
            key={providerId}
            className="border-border flex items-start justify-between rounded-lg border p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {humanizeProviderTitle(providerId, provider.title)}
                </span>
                {provider.experimental && (
                  <Badge variant="secondary">Experimental</Badge>
                )}
                {hasCredentials ? (
                  <Badge>Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              {status?.selectedAuthMethod && (
                <p className="text-muted-foreground text-xs">
                  Method: {status.selectedAuthMethod}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {provider.baseUrl}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openConnect(providerId)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {hasCredentials ? 'Manage' : 'Connect'}
              </Button>
              {hasCredentials && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void logout(providerId)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function useAiProviderAuth() {
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const aiConnect = useStoreWithAiConnect((s) => s.aiConnect);

  return {
    providers,
    ...aiConnect,
  };
}
