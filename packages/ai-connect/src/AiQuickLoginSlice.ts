import {
  useBaseRoomStore,
  createSlice,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {AiSettingsSliceState} from '@sqlrooms/ai-settings';
import type {AiConnectSliceState} from './AiConnectSlice';
import type {AiLoginTarget, AiQuickLoginMode} from './types';
import {resolveLoginTargetsFromProviders} from './loginTargets';

export type AiQuickLoginSliceState = {
  aiQuickLogin: {
    dialogOpen: boolean;
    selectedTargetId?: string;
    mode: AiQuickLoginMode;
    loginTargets: AiLoginTarget[];
    open: (targetId?: string) => void;
    close: () => void;
    selectTarget: (targetId: string) => void;
    startSelectedLogin: (targetId?: string) => Promise<boolean>;
  };
};

type AiStateWithQuickLogin = AiSettingsSliceState &
  AiConnectSliceState &
  AiQuickLoginSliceState;

type CreateAiQuickLoginSliceParams = {
  loginTargets?: AiLoginTarget[];
};

function getVisibleTargets(state: AiStateWithQuickLogin) {
  return resolveLoginTargetsFromProviders(
    state.aiSettings.config.providers,
    state.aiQuickLogin.loginTargets,
  );
}

export function createAiQuickLoginSlice(
  props: CreateAiQuickLoginSliceParams = {},
): StateCreator<AiQuickLoginSliceState> {
  const initialTargets = props.loginTargets ?? [];

  return createSlice<
    AiQuickLoginSliceState,
    AiSettingsSliceState & AiConnectSliceState & AiQuickLoginSliceState
  >((set, get) => ({
    aiQuickLogin: {
      dialogOpen: false,
      selectedTargetId: initialTargets[0]?.id,
      mode: 'login',
      loginTargets: initialTargets,

      open: (targetId) => {
        set((state) =>
          produce(state, (draft) => {
            const visibleTargets = resolveLoginTargetsFromProviders(
              draft.aiSettings.config.providers,
              draft.aiQuickLogin.loginTargets,
            );
            const existingSelection = visibleTargets.find(
              (target) => target.id === draft.aiQuickLogin.selectedTargetId,
            );
            draft.aiQuickLogin.dialogOpen = true;
            draft.aiQuickLogin.mode = 'login';
            draft.aiQuickLogin.selectedTargetId =
              targetId || existingSelection?.id || visibleTargets[0]?.id;
          }),
        );
      },

      close: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiQuickLogin.dialogOpen = false;
          }),
        );
      },

      selectTarget: (targetId) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiQuickLogin.selectedTargetId = targetId;
          }),
        );
      },

      startSelectedLogin: async (targetId) => {
        const state = get();
        const visibleTargets = getVisibleTargets(state);
        const effectiveTargetId =
          targetId ||
          state.aiQuickLogin.selectedTargetId ||
          visibleTargets[0]?.id;
        if (!effectiveTargetId) {
          return false;
        }

        const target = visibleTargets.find(
          (entry) => entry.id === effectiveTargetId,
        );
        if (!target) {
          return false;
        }

        set((currentState) =>
          produce(currentState, (draft) => {
            draft.aiQuickLogin.selectedTargetId = target.id;
            draft.aiQuickLogin.dialogOpen = false;
          }),
        );

        get().aiConnect.openConnect(target.providerId, target.authMethodId);
        const instructions = await get().aiConnect.startAuth();
        return Boolean(instructions);
      },
    },
  }));
}

export function useStoreWithAiQuickLogin<T>(
  selector: (state: AiStateWithQuickLogin) => T,
): T {
  return useBaseRoomStore<AiStateWithQuickLogin, T>((state) =>
    selector(state as unknown as AiStateWithQuickLogin),
  );
}
