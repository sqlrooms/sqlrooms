import {
  useBaseRoomStore,
  createSlice,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  createAiSettingsSlice,
  type AiSettingsSliceState,
} from '@sqlrooms/ai-settings';
import type {
  AiAuthClient,
  AiConnectStep,
  AiProviderAuthInstructions,
} from './types';

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
    openConnect: (providerId?: string, methodId?: string) => void;
    closeConnect: () => void;
    selectProvider: (providerId: string) => void;
    selectMethod: (methodId: string) => void;
    startAuth: () => Promise<AiProviderAuthInstructions | null>;
    submitCode: (code: string) => Promise<boolean>;
    submitApiKey: (apiKey: string) => Promise<boolean>;
    cancelAuth: () => void;
    logout: (providerId: string) => Promise<boolean>;
    refreshProviderStatus: (providerId?: string) => Promise<boolean>;
    clearError: () => void;
    setApiKeyDraft: (apiKey: string) => void;
    setCodeDraft: (code: string) => void;
  };
};

type AiStateWithConnect = AiSettingsSliceState & AiConnectSliceState;

type CreateAiConnectSliceParams = {
  authClient: AiAuthClient;
};

function stepForFlowType(flowType: string): AiConnectStep {
  if (flowType === 'local') return 'success';
  if (flowType === 'oauth_auto') return 'oauth_wait';
  if (flowType === 'oauth_popup') return 'oauth_wait';
  if (flowType === 'oauth_redirect') return 'oauth_wait';
  if (flowType === 'external_credentials') return 'oauth_wait';
  if (flowType === 'device_code') return 'device_code';
  if (flowType === 'oauth_code') return 'enter_code';
  if (flowType === 'oauth_to_api_key') return 'enter_code';
  if (flowType === 'api_key') return 'enter_api_key';
  return 'pick_method';
}

async function syncProviders(
  get: () => AiStateWithConnect,
  authClient: AiAuthClient,
) {
  const providers = await authClient.listProviders();
  get().aiSettings.replaceProviders(providers, false);
}

export function createAiConnectSlice(
  props: CreateAiConnectSliceParams,
): StateCreator<AiConnectSliceState> {
  const {authClient} = props;

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

      openConnect: (providerId, methodId) => {
        set((state) =>
          produce(state, (draft) => {
            const provider = providerId
              ? draft.aiSettings.config.providers[providerId]
              : undefined;
            draft.aiConnect.dialogOpen = true;
            draft.aiConnect.currentProviderId =
              providerId || draft.aiConnect.currentProviderId;
            draft.aiConnect.currentMethodId =
              methodId ||
              provider?.status?.selectedAuthMethod ||
              provider?.defaultAuthMethod ||
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
              provider?.status?.selectedAuthMethod ||
              provider?.defaultAuthMethod ||
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

      startAuth: async () => {
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
          const instructions = await authClient.startAuth(
            providerId,
            authMethodId,
          );
          await syncProviders(get, authClient);
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

      submitCode: async (code) => {
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
          await authClient.completeAuth(providerId, authMethodId, {code});
          await syncProviders(get, authClient);
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

      submitApiKey: async (apiKey) => {
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
          await authClient.completeAuth(providerId, authMethodId, {apiKey});
          await syncProviders(get, authClient);
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

      logout: async (providerId) => {
        try {
          await authClient.logout(providerId);
          await syncProviders(get, authClient);
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

      refreshProviderStatus: async (providerId) => {
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
            await authClient.completeAuth(activeProviderId, activeMethodId, {});
            await syncProviders(get, authClient);
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

        try {
          await syncProviders(get, authClient);
          if (activeProviderId) {
            const provider =
              get().aiSettings.config.providers[activeProviderId];
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
  props: CreateAiConnectSliceParams,
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
