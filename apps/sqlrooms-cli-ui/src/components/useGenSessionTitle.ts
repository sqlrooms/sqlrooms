import {
  isDefaultGeneratedSessionName,
  useGenerateSessionTitle,
} from '@sqlrooms/ai';

export const isDefaultAssistantSessionName = isDefaultGeneratedSessionName;

export function useGenSessionTitle() {
  useGenerateSessionTitle({
    isDefaultSessionName: isDefaultAssistantSessionName,
    onError: (error) => {
      console.error('Error generating session title:', error);
    },
  });
}
