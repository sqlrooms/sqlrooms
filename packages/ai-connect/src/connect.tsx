import React from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {
  Check,
  ChevronsUpDown,
  KeyRound,
  LinkIcon,
  LogOut,
  PlugZap,
  RefreshCw,
} from 'lucide-react';
import {useStoreWithAiSettings} from '@sqlrooms/ai-settings';
import type {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '@sqlrooms/ai-core';
import {useStoreWithAiConnect} from './AiConnectSlice';
import type {AiDiscoveredModel, AiProviderAuthInstructions} from './types';

function humanizeProviderTitle(providerId: string, title?: string): string {
  if (title?.trim()) return title;
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

function humanizeAuthMethod(methodId?: string | null): string {
  if (!methodId) return '';
  return methodId.replace(/_/g, ' ');
}

type ProviderForStatus =
  AiSettingsSliceConfig['providers'][string] & {kind?: string};

function getProviderStatusDisplay(provider: ProviderForStatus): {
  label: string;
  badgeVariant: React.ComponentProps<typeof Badge>['variant'];
  detail?: string;
} {
  const status = provider.status;
  const credentialType = status?.credentialType || provider.credentialType;
  const selectedMethod = status?.selectedAuthMethod || provider.selectedAuthMethod;
  const authMethodType = provider.authMethodType;
  const defaultAuthMethod = provider.defaultAuthMethod;

  if (
    credentialType === 'local' ||
    authMethodType === 'local' ||
    defaultAuthMethod === 'local'
  ) {
    return {
      label: 'Local runtime',
      badgeVariant: 'secondary',
      detail: 'No API key required',
    };
  }

  if (status?.hasCredentials || provider.hasCredentials) {
    if (credentialType === 'env_api_key') {
      return {
        label: 'Env key found',
        badgeVariant: 'secondary',
        detail: selectedMethod
          ? `Auth: ${humanizeAuthMethod(selectedMethod)}`
          : undefined,
      };
    }
    if (credentialType === 'config_api_key') {
      return {
        label: 'Config key',
        badgeVariant: 'secondary',
        detail: 'Loaded from TOML; not exposed to the browser',
      };
    }
    if (credentialType === 'api_key') {
      return {
        label: 'Saved key',
        badgeVariant: 'default',
        detail: selectedMethod
          ? `Auth: ${humanizeAuthMethod(selectedMethod)}`
          : undefined,
      };
    }
    if (credentialType === 'oauth') {
      return {
        label: 'Logged in',
        badgeVariant: 'default',
        detail: selectedMethod
          ? `Auth: ${humanizeAuthMethod(selectedMethod)}`
          : undefined,
      };
    }
    return {
      label: 'Connected',
      badgeVariant: 'default',
      detail: selectedMethod
        ? `Auth: ${humanizeAuthMethod(selectedMethod)}`
        : undefined,
    };
  }

  if (provider.kind === 'builtin') {
    return {
      label: 'Built-in',
      badgeVariant: 'outline',
      detail: selectedMethod
        ? `Default auth: ${humanizeAuthMethod(selectedMethod)}`
        : undefined,
    };
  }

  return {
    label: 'Not connected',
    badgeVariant: 'outline',
    detail: selectedMethod
      ? `Auth: ${humanizeAuthMethod(selectedMethod)}`
      : undefined,
  };
}

const MODEL_CATEGORY_ORDER = [
  'Reasoning',
  'Chat',
  'Models',
];

/*
 * Keep model discovery permissive: providers do not expose a portable
 * "supports assistant/tool use" schema, so only filter modalities that are
 * clearly irrelevant for chat. The user can choose among the remaining models.
 */
function getModelCategory(model: AiDiscoveredModel): string {
  const type = model.type?.toLowerCase() || '';
  if (type.includes('reasoning') || type.includes('reasoner')) {
    return 'Reasoning';
  }
  if (
    type.includes('chat') ||
    type.includes('assistant') ||
    type.includes('language') ||
    type.includes('text-generation')
  ) {
    return 'Chat';
  }
  return 'Models';
}

function isClearlyIrrelevantAssistantModel(model: AiDiscoveredModel): boolean {
  const type = model.type?.toLowerCase() || '';
  const name = model.modelName.toLowerCase();
  const haystack = `${type} ${name}`;
  const irrelevantPatterns = [
    'audio',
    'dall-e',
    'embed',
    'embedding',
    'image',
    'moderation',
    'rerank',
    'speech',
    'stt',
    'transcribe',
    'translation',
    'tts',
    'whisper',
  ];
  return irrelevantPatterns.some((pattern) => haystack.includes(pattern));
}

function isAssistantCandidateModel(model: AiDiscoveredModel): boolean {
  if (isClearlyIrrelevantAssistantModel(model)) return false;
  if (model.supportsTools === false) return false;
  return true;
}

function getSortedModelGroups(models: AiDiscoveredModel[]) {
  const sorted = models.filter(isAssistantCandidateModel).sort((a, b) => {
    const byDate = (b.releasedAt || 0) - (a.releasedAt || 0);
    if (byDate !== 0) return byDate;
    return a.modelName.localeCompare(b.modelName);
  });

  const groups = new Map<string, AiDiscoveredModel[]>();
  for (const model of sorted) {
    const category = getModelCategory(model);
    groups.set(category, [...(groups.get(category) || []), model]);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = MODEL_CATEGORY_ORDER.indexOf(a);
    const bIndex = MODEL_CATEGORY_ORDER.indexOf(b);
    return (
      (aIndex === -1 ? MODEL_CATEGORY_ORDER.length : aIndex) -
      (bIndex === -1 ? MODEL_CATEGORY_ORDER.length : bIndex)
    );
  });
}

function getAssistantReadyModels(models: AiDiscoveredModel[]) {
  return getSortedModelGroups(models).flatMap(([, groupModels]) => groupModels);
}

function formatModelDate(releasedAt?: number) {
  if (!releasedAt) return '';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
  }).format(new Date(releasedAt));
}

function DiscoveredModelPicker(props: {
  models: AiDiscoveredModel[];
  selectedModel: string;
  onSelectedModelChange: (modelName: string) => void;
}) {
  const {models, selectedModel, onSelectedModelChange} = props;
  const [open, setOpen] = React.useState(false);
  const selected = models.find((model) => model.modelName === selectedModel);
  const groups = React.useMemo(() => getSortedModelGroups(models), [models]);

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-0 flex-1 justify-between"
        >
          <span className="truncate">
            {selected?.title || selected?.modelName || 'Select a model'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
        className="w-[min(32rem,calc(100vw-4rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList className="max-h-[min(22rem,var(--radix-popover-content-available-height))] overscroll-contain">
            <CommandEmpty>No models found.</CommandEmpty>
            {groups.map(([category, groupModels]) => (
              <CommandGroup key={category} heading={category}>
                {groupModels.map((model) => {
                  const isSelected = model.modelName === selectedModel;
                  return (
                    <CommandItem
                      key={model.modelName}
                      value={`${model.modelName} ${model.title || ''} ${category}`}
                      onSelect={() => {
                        onSelectedModelChange(model.modelName);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {model.title || model.modelName}
                      </span>
                      {model.title && model.title !== model.modelName && (
                        <span className="text-muted-foreground max-w-36 truncate text-xs">
                          {model.modelName}
                        </span>
                      )}
                      {model.releasedAt && (
                        <span className="text-muted-foreground text-xs">
                          {formatModelDate(model.releasedAt)}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
    closeConnect,
    currentProviderId,
    discoveringModelsProviderId,
    discoveredModels,
    discoverModels,
  } = useStoreWithAiConnect((s) => s.aiConnect);
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const addModelToProvider = useStoreWithAiSettings(
    (s) => s.aiSettings.addModelToProvider,
  );
  const setDefaultProvider = useStoreWithAiSettings(
    (s) => s.aiSettings.setDefaultProvider,
  );
  const setDefaultModel = useStoreWithAiSettings(
    (s) => s.aiSettings.setDefaultModel,
  );
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);
  const [selectedDiscoveredModel, setSelectedDiscoveredModel] =
    React.useState('');

  const currentProvider = currentProviderId
    ? providers[currentProviderId]
    : undefined;
  const currentProviderModels = currentProvider?.models || [];
  const currentDiscovery = currentProviderId
    ? discoveredModels[currentProviderId]
    : undefined;
  const discoveredProviderModels = React.useMemo(
    () => getAssistantReadyModels(currentDiscovery?.models || []),
    [currentDiscovery?.models],
  );
  const isModelDiscoveryPending =
    discoveringModelsProviderId === currentProviderId;
  const isDiscoveringModels = isModelDiscoveryPending || !currentDiscovery;

  React.useEffect(() => {
    if (
      step !== 'success' ||
      !currentProviderId ||
      currentProviderModels.length > 0 ||
      currentDiscovery ||
      isModelDiscoveryPending
    ) {
      return;
    }
    void discoverModels(currentProviderId);
  }, [
    currentDiscovery,
    currentProviderId,
    currentProviderModels.length,
    discoverModels,
    isModelDiscoveryPending,
    step,
  ]);

  React.useEffect(() => {
    if (!discoveredProviderModels.length) return;
    setSelectedDiscoveredModel((current) =>
      discoveredProviderModels.some((model) => model.modelName === current)
        ? current
        : discoveredProviderModels[0]?.modelName || '',
    );
  }, [discoveredProviderModels]);

  const addDiscoveredModel = () => {
    if (!currentProviderId || !selectedDiscoveredModel) return;
    addModelToProvider(currentProviderId, selectedDiscoveredModel);
    setDefaultProvider(currentProviderId);
    setDefaultModel(selectedDiscoveredModel);
    setAiModel(currentProviderId, selectedDiscoveredModel);
  };

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
      <div className="space-y-3">
        <Alert>
          <AlertDescription>Provider connected successfully.</AlertDescription>
        </Alert>
        {currentProviderId && currentProviderModels.length === 0 && (
          <div className="border-border space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Choose a model</p>
              {isDiscoveringModels ? (
                <p className="text-muted-foreground text-xs">
                  Fetching available models from the provider…
                </p>
              ) : currentDiscovery?.error ? (
                <p className="text-destructive text-xs">
                  {currentDiscovery.error}
                </p>
              ) : currentDiscovery && discoveredProviderModels.length ? (
                <p className="text-muted-foreground text-xs">
                  Select a model to add to this workspace.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No assistant-compatible models were found.
                </p>
              )}
            </div>

            {discoveredProviderModels.length > 0 && (
              <div className="flex items-center gap-2">
                <DiscoveredModelPicker
                  models={discoveredProviderModels}
                  selectedModel={selectedDiscoveredModel}
                  onSelectedModelChange={setSelectedDiscoveredModel}
                />
                <Button
                  variant="secondary"
                  onClick={addDiscoveredModel}
                  disabled={!selectedDiscoveredModel}
                >
                  Add model
                </Button>
              </div>
            )}

            {!isDiscoveringModels && currentDiscovery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void discoverModels(currentProviderId)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh models
              </Button>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={closeConnect}>Close</Button>
        </DialogFooter>
      </div>
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

function AiProviderModelDiscovery(props: {
  providerId: string;
  provider: ProviderForStatus;
}) {
  const {providerId, provider} = props;
  const discoverModels = useStoreWithAiConnect(
    (s) => s.aiConnect.discoverModels,
  );
  const discoveringModelsProviderId = useStoreWithAiConnect(
    (s) => s.aiConnect.discoveringModelsProviderId,
  );
  const discoveredModels = useStoreWithAiConnect(
    (s) => s.aiConnect.discoveredModels,
  );
  const addModelToProvider = useStoreWithAiSettings(
    (s) => s.aiSettings.addModelToProvider,
  );
  const setDefaultProvider = useStoreWithAiSettings(
    (s) => s.aiSettings.setDefaultProvider,
  );
  const setDefaultModel = useStoreWithAiSettings(
    (s) => s.aiSettings.setDefaultModel,
  );
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);
  const [selectedModel, setSelectedModel] = React.useState('');

  const discovery = discoveredModels[providerId];
  const models = React.useMemo(
    () => getAssistantReadyModels(discovery?.models || []),
    [discovery?.models],
  );
  const isDiscovering = discoveringModelsProviderId === providerId;
  const providerModelNames = React.useMemo(
    () => new Set((provider.models || []).map((model) => model.modelName)),
    [provider.models],
  );
  const selectedAlreadyConfigured = providerModelNames.has(selectedModel);

  React.useEffect(() => {
    if (!models.length) return;
    setSelectedModel((current) =>
      models.some((model) => model.modelName === current)
        ? current
        : models[0]?.modelName || '',
    );
  }, [models]);

  const handleAddModel = () => {
    if (!selectedModel) return;
    if (!selectedAlreadyConfigured) {
      addModelToProvider(providerId, selectedModel);
    }
    setDefaultProvider(providerId);
    setDefaultModel(selectedModel);
    setAiModel(providerId, selectedModel);
  };

  return (
    <div className="pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void discoverModels(providerId)}
        disabled={isDiscovering}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        {isDiscovering ? 'Fetching models…' : 'Models'}
      </Button>

      {discovery?.error && (
        <p className="text-destructive mt-2 text-xs">{discovery.error}</p>
      )}

      {discovery && !discovery.error && models.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          No assistant-compatible models were found.
        </p>
      )}

      {models.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DiscoveredModelPicker
            models={models}
            selectedModel={selectedModel}
            onSelectedModelChange={setSelectedModel}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddModel}
            disabled={!selectedModel}
          >
            {selectedAlreadyConfigured ? 'Select' : 'Add'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AiProviderStatusList(_props: {
  apiBaseUrl?: string;
  showBuiltinTemplates?: boolean;
}) {
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const logout = useStoreWithAiConnect((s) => s.aiConnect.logout);
  const openConnect = useStoreWithAiConnect((s) => s.aiConnect.openConnect);
  const testProvider = useStoreWithAiConnect((s) => s.aiConnect.testProvider);
  const testingProviderId = useStoreWithAiConnect(
    (s) => s.aiConnect.testingProviderId,
  );
  const testResults = useStoreWithAiConnect((s) => s.aiConnect.testResults);

  const showBuiltinTemplates = _props.showBuiltinTemplates ?? true;
  const providerEntries = Object.entries(providers).filter(([, provider]) => {
    if (showBuiltinTemplates) return true;
    const credentialType = provider.status?.credentialType || provider.credentialType;
    const hasSavedCredentials =
      Boolean(provider.status?.hasCredentials || provider.hasCredentials) &&
      credentialType !== 'local';
    return Boolean(provider.configured || provider.apiKey || hasSavedCredentials);
  });

  return (
    <div className="space-y-3">
      {providerEntries.length === 0 && (
        <div className="border-border flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">No AI providers configured</p>
            <p className="text-muted-foreground text-sm">
              Connect a provider or add one manually to start chatting.
            </p>
          </div>
          <AiProviderConnectButton variant="secondary" />
        </div>
      )}
      {providerEntries.map(([providerId, provider]) => {
        const status = provider.status;
        const hasCredentials = Boolean(status?.hasCredentials);
        const credentialType = status?.credentialType || provider.credentialType;
        const isLocalProvider =
          credentialType === 'local' ||
          provider.authMethodType === 'local' ||
          provider.defaultAuthMethod === 'local';
        const statusDisplay = getProviderStatusDisplay(provider);
        const canLogout =
          credentialType === 'api_key' || credentialType === 'oauth';
        const showConnectButton = !isLocalProvider;
        const showTestButton =
          Boolean(provider.baseUrl || provider.upstreamBaseUrl) ||
          Boolean(provider.authMethods?.length);
        const testResult = testResults[providerId];
        const isTesting = testingProviderId === providerId;
        const displayBaseUrl =
          provider.proxyEnabled && provider.upstreamBaseUrl
            ? provider.upstreamBaseUrl
            : provider.baseUrl;
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
                <Badge variant={statusDisplay.badgeVariant}>
                  {statusDisplay.label}
                </Badge>
              </div>
              {statusDisplay.detail && (
                <p className="text-muted-foreground text-xs">
                  {statusDisplay.detail}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {displayBaseUrl}
              </p>
              {testResult && (
                <p
                  className={
                    testResult.ok
                      ? 'text-xs text-emerald-600'
                      : 'text-destructive text-xs'
                  }
                >
                  {testResult.ok
                    ? testResult.message || 'Connection test passed.'
                    : testResult.message ||
                      testResult.error ||
                      'Connection test failed.'}
                </p>
              )}
              {(hasCredentials || provider.apiKey) && !isLocalProvider && (
                <AiProviderModelDiscovery
                  providerId={providerId}
                  provider={provider}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {showConnectButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConnect(providerId)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {hasCredentials ? 'Manage' : 'Connect'}
                </Button>
              )}
              {showTestButton && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void testProvider(providerId)}
                    disabled={isTesting}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isTesting ? 'Testing…' : 'Test'}
                  </Button>
                  {canLogout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void logout(providerId)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </>
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
