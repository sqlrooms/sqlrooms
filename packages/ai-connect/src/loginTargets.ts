import type {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import type {AiLoginTarget} from './types';

const DEFAULT_LOGIN_TARGETS: AiLoginTarget[] = [
  {
    id: 'anthropic-subscription',
    label: 'Anthropic (Claude Pro/Max)',
    providerId: 'anthropic',
    authMethodId: 'claude_pro',
    experimental: true,
    priority: 100,
  },
  {
    id: 'openai-codex-subscription',
    label: 'ChatGPT Plus/Pro (Codex Subscription)',
    providerId: 'openai',
    authMethodId: 'codex_browser',
    experimental: true,
    priority: 200,
  },
];

function hasProviderAuthMethod(
  providers: AiSettingsSliceConfig['providers'],
  target: AiLoginTarget,
) {
  const provider = providers[target.providerId];
  if (!provider) return false;
  return provider.authMethods.some(
    (method) => method.id === target.authMethodId,
  );
}

export function resolveLoginTargetsFromProviders(
  providers: AiSettingsSliceConfig['providers'],
  loginTargets: AiLoginTarget[] = DEFAULT_LOGIN_TARGETS,
): AiLoginTarget[] {
  return loginTargets
    .filter((target) => !target.hidden)
    .filter((target) => hasProviderAuthMethod(providers, target))
    .sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.label.localeCompare(b.label);
    });
}
