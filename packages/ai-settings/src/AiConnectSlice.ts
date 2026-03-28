import {AiSettingsSliceState, createAiSettingsSlice} from './AiSettingsSlice';
import {
  createSlice,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';

export type AiConnectStep =
  | 'idle'
  | 'pick_provider'
  | 'pick_method'
  | 'oauth_wait'
  | 'device_code'
  | 'enter_code'
  | 'enter_api_key'
  | 'success'
  | 'error';

export type AiProviderAuthInstructions = {
  providerId: string;
  authMethodId: string;
  flowType: string;
  url?: string;
  instructions: string;
  codeFormatHint?: string;
  pollIntervalMs?: number;
  userCode?: string;
};

export type AiConnectSliceState = {
  aiConnect: {
    dialogOpen: boolean;
    currentProviderId?: string;
    currentMethodId?: string;
    step: AiConnectStep;
    pending: boolean;
    instructions: AiProviderAuthInstructions | null;
    error: string | null;
    apiKeyDraft: string;
    codeDraft: string;
    openConnect: (providerId?: string) => void;
    closeConnect: () => void;
    selectProvider: (providerId: string) => void;
    selectMethod: (methodId: string) => void;
    startAuth: (
      apiBaseUrl?: string,
    ) => Promise<AiProviderAuthInstructions | null>;
    submitCode: (code: string, apiBaseUrl?: string) => Promise<boolean>;
    submitApiKey: (apiKey: string, apiBaseUrl?: string) => Promise<boolean>;
    cancelAuth: () => void;
    logout: (providerId: string, apiBaseUrl?: string) => Promise<boolean>;
    refreshProviderStatus: (
      providerId?: string,
      apiBaseUrl?: string,
    ) => Promise<boolean>;
    clearError: () => void;
    setApiKeyDraft: (apiKey: string) => void;
    setCodeDraft: (code: string) => void;
  };
};

type CreateAiConnectSliceParams = {
  apiBaseUrl?: string;
};

type AiStateWithConnect = AiSettingsSliceState & AiConnectSliceState;

function stepForFlowType(flowType: string): AiConnectStep {
  if (flowType === 'local') return 'success';
  if (flowType === 'oauth_auto') return 'oauth_wait';
  if (flowType === 'external_credentials') return 'oauth_wait';
  if (flowType === 'device_code') return 'device_code';
  if (flowType === 'oauth_code') return 'enter_code';
  if (flowType === 'api_key') return 'enter_api_key';
  return 'pick_method';
}

export function createAiConnectSlice(
  props?: CreateAiConnectSliceParams,
): StateCreator<AiConnectSliceState> {
  const defaultApiBaseUrl = props?.apiBaseUrl || '';

  return createSlice<
    AiConnectSliceState,
    AiConnectSliceState & AiSettingsSliceState
  >((set, get) => ({
    aiConnect: {
      dialogOpen: false,
      currentProviderId: undefined,
      currentMethodId: undefined,
      step: 'idle',
      pending: false,
      instructions: null,
      error: null,
      apiKeyDraft: '',
      codeDraft: '',

      openConnect: (providerId) => {
        set((state) =>
          produce(state, (draft) => {
            const provider = providerId
              ? draft.aiSettings.config.providers[providerId]
              : undefined;
            draft.aiConnect.dialogOpen = true;
            draft.aiConnect.currentProviderId =
              providerId || draft.aiConnect.currentProviderId;
            draft.aiConnect.currentMethodId =
              provider?.defaultAuthMethod ||
              provider?.status?.selectedAuthMethod ||
              provider?.authMethods?.[0]?.id;
            draft.aiConnect.step = providerId ? 'pick_method' : 'pick_provider';
            draft.aiConnect.error = null;
          }),
        );
      },

      closeConnect: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiConnect.dialogOpen = false;
            draft.aiConnect.currentProviderId = undefined;
            draft.aiConnect.currentMethodId = undefined;
            draft.aiConnect.step = 'idle';
            draft.aiConnect.pending = false;
            draft.aiConnect.instructions = null;
            draft.aiConnect.error = null;
            draft.aiConnect.apiKeyDraft = '';
            draft.aiConnect.codeDraft = '';
          }),
        );
      },

      selectProvider: (providerId) => {
        set((state) =>
          produce(state, (draft) => {
            const provider = draft.aiSettings.config.providers[providerId];
            draft.aiConnect.currentProviderId = providerId;
            draft.aiConnect.currentMethodId =
              provider?.defaultAuthMethod ||
              provider?.status?.selectedAuthMethod ||
              provider?.authMethods?.[0]?.id;
            draft.aiConnect.step = 'pick_method';
            draft.aiConnect.error = null;
          }),
        );
      },

      selectMethod: (methodId) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiConnect.currentMethodId = methodId;
            draft.aiConnect.error = null;
            draft.aiConnect.instructions = null;
          }),
        );
      },

      startAuth: async (apiBaseUrl = defaultApiBaseUrl) => {
        const state = get();
        const providerId = state.aiConnect.currentProviderId;
        const authMethodId = state.aiConnect.currentMethodId;
        if (!providerId || !authMethodId) {
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.error = 'Select a provider and auth method first.';
              next.aiConnect.step = 'error';
            }),
          );
          return null;
        }

        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.pending = true;
            next.aiConnect.error = null;
          }),
        );

        try {
          const res = await fetch(`${apiBaseUrl}/api/ai/auth/start`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({providerId, authMethodId}),
          });
          const body = (await res.json().catch(() => ({}))) as
            | AiProviderAuthInstructions
            | {error?: string};
          if (!res.ok) {
            throw new Error(
              'error' in body
                ? body.error || `Server returned ${res.status}`
                : `Server returned ${res.status}`,
            );
          }
          const instructions = body as AiProviderAuthInstructions;
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.instructions = instructions;
              next.aiConnect.step = stepForFlowType(instructions.flowType);
            }),
          );
          return instructions;
        } catch (error) {
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.error =
                error instanceof Error ? error.message : String(error);
              next.aiConnect.step = 'error';
            }),
          );
          return null;
        }
      },

      submitCode: async (code, apiBaseUrl = defaultApiBaseUrl) => {
        const state = get();
        const providerId = state.aiConnect.currentProviderId;
        const authMethodId = state.aiConnect.currentMethodId;
        if (!providerId || !authMethodId) return false;

        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.pending = true;
            next.aiConnect.error = null;
            next.aiConnect.codeDraft = code;
          }),
        );

        try {
          const res = await fetch(`${apiBaseUrl}/api/ai/auth/complete`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({providerId, authMethodId, code}),
          });
          const body = (await res.json().catch(() => ({}))) as {error?: string};
          if (!res.ok) {
            throw new Error(body.error || `Server returned ${res.status}`);
          }
          await get().aiSettings.loadFromServer(apiBaseUrl);
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.step = 'success';
              next.aiConnect.error = null;
            }),
          );
          return true;
        } catch (error) {
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.error =
                error instanceof Error ? error.message : String(error);
              next.aiConnect.step = 'error';
            }),
          );
          return false;
        }
      },

      submitApiKey: async (apiKey, apiBaseUrl = defaultApiBaseUrl) => {
        const state = get();
        const providerId = state.aiConnect.currentProviderId;
        const authMethodId = state.aiConnect.currentMethodId;
        if (!providerId || !authMethodId) return false;

        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.pending = true;
            next.aiConnect.error = null;
            next.aiConnect.apiKeyDraft = apiKey;
          }),
        );

        try {
          const res = await fetch(`${apiBaseUrl}/api/ai/auth/complete`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({providerId, authMethodId, apiKey}),
          });
          const body = (await res.json().catch(() => ({}))) as {error?: string};
          if (!res.ok) {
            throw new Error(body.error || `Server returned ${res.status}`);
          }
          await get().aiSettings.loadFromServer(apiBaseUrl);
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.step = 'success';
              next.aiConnect.error = null;
            }),
          );
          return true;
        } catch (error) {
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.pending = false;
              next.aiConnect.error =
                error instanceof Error ? error.message : String(error);
              next.aiConnect.step = 'error';
            }),
          );
          return false;
        }
      },

      cancelAuth: () => {
        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.pending = false;
            next.aiConnect.instructions = null;
            next.aiConnect.error = null;
            next.aiConnect.step = next.aiConnect.currentProviderId
              ? 'pick_method'
              : 'pick_provider';
          }),
        );
      },

      logout: async (providerId, apiBaseUrl = defaultApiBaseUrl) => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/ai/auth/logout`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({providerId}),
          });
          const body = (await res.json().catch(() => ({}))) as {error?: string};
          if (!res.ok) {
            throw new Error(body.error || `Server returned ${res.status}`);
          }
          await get().aiSettings.loadFromServer(apiBaseUrl);
          return true;
        } catch (error) {
          set((draft) =>
            produce(draft, (next) => {
              next.aiConnect.error =
                error instanceof Error ? error.message : String(error);
              next.aiConnect.step = 'error';
            }),
          );
          return false;
        }
      },

      refreshProviderStatus: async (
        providerId,
        apiBaseUrl = defaultApiBaseUrl,
      ) => {
        const state = get();
        const activeProviderId =
          providerId || state.aiConnect.currentProviderId;
        const activeMethodId = state.aiConnect.currentMethodId;
        const flowType = state.aiConnect.instructions?.flowType;

        if (activeProviderId && activeMethodId && flowType === 'device_code') {
          try {
            set((draft) =>
              produce(draft, (next) => {
                next.aiConnect.pending = true;
                next.aiConnect.error = null;
              }),
            );
            const res = await fetch(`${apiBaseUrl}/api/ai/auth/complete`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                providerId: activeProviderId,
                authMethodId: activeMethodId,
              }),
            });
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            if (!res.ok) {
              throw new Error(body.error || `Server returned ${res.status}`);
            }
            await get().aiSettings.loadFromServer(apiBaseUrl);
            set((draft) =>
              produce(draft, (next) => {
                next.aiConnect.pending = false;
                next.aiConnect.step = 'success';
                next.aiConnect.error = null;
              }),
            );
            return true;
          } catch (error) {
            set((draft) =>
              produce(draft, (next) => {
                next.aiConnect.pending = false;
                next.aiConnect.error =
                  error instanceof Error ? error.message : String(error);
                next.aiConnect.step = 'device_code';
              }),
            );
            return false;
          }
        }

        const loaded = await get().aiSettings.loadFromServer(apiBaseUrl);
        if (!loaded) {
          return false;
        }

        if (activeProviderId) {
          const provider = get().aiSettings.config.providers[activeProviderId];
          if (provider?.status?.hasCredentials) {
            set((draft) =>
              produce(draft, (next) => {
                next.aiConnect.step = 'success';
                next.aiConnect.error = null;
              }),
            );
          }
        }
        return true;
      },

      clearError: () => {
        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.error = null;
            if (next.aiConnect.step === 'error') {
              next.aiConnect.step = next.aiConnect.currentProviderId
                ? 'pick_method'
                : 'pick_provider';
            }
          }),
        );
      },

      setApiKeyDraft: (apiKey) => {
        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.apiKeyDraft = apiKey;
          }),
        );
      },

      setCodeDraft: (code) => {
        set((draft) =>
          produce(draft, (next) => {
            next.aiConnect.codeDraft = code;
          }),
        );
      },
    },
  }));
}

export function createAiAssistantSettingsSlices(
  props?: CreateAiConnectSliceParams,
) {
  return {
    createAiSettingsSlice,
    createAiConnectSlice: () => createAiConnectSlice(props),
  };
}

export function useStoreWithAiConnect<T>(
  selector: (state: AiStateWithConnect) => T,
): T {
  return useBaseRoomStore<AiStateWithConnect, T>((state) =>
    selector(state as unknown as AiStateWithConnect),
  );
}
