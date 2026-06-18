import {wrapLanguageModel, type LanguageModel} from 'ai';

type WrappableLanguageModel = Parameters<typeof wrapLanguageModel>[0]['model'];
type LanguageModelMiddleware = Parameters<
  typeof wrapLanguageModel
>[0]['middleware'];
type DevToolsModule = {
  devToolsMiddleware: () => LanguageModelMiddleware;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

const AI_SDK_DEVTOOLS_PACKAGE = '@ai-sdk/devtools';

const getProcess = (): ProcessLike | undefined => {
  const maybeGlobal = globalThis as typeof globalThis & {
    process?: ProcessLike;
  };
  return maybeGlobal.process;
};

export function isAiSdkDevToolsEnabled(): boolean {
  const env = getProcess()?.env;
  return env?.SQLROOMS_AI_SDK_DEVTOOLS === '1' && env.NODE_ENV !== 'production';
}

export async function maybeWrapModelWithDevTools(
  model: LanguageModel,
): Promise<LanguageModel> {
  if (!isAiSdkDevToolsEnabled()) {
    return model;
  }

  try {
    const {devToolsMiddleware} = (await import(
      /* @vite-ignore */ AI_SDK_DEVTOOLS_PACKAGE
    )) as DevToolsModule;
    return wrapLanguageModel({
      model: model as WrappableLanguageModel,
      middleware: devToolsMiddleware(),
    }) as LanguageModel;
  } catch (error) {
    console.warn('Failed to enable AI SDK DevTools middleware:', error);
    return model;
  }
}
