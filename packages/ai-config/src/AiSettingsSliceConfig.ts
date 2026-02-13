import {z} from 'zod';

/**
 * Shared symbol contract with `@sqlrooms/room-store`'s `createPersistHelpers`.
 *
 * `Symbol.for(...)` keeps this package aligned with `room-store` at runtime
 * without introducing a direct runtime dependency.
 */
const PersistMergeInputSymbol = Symbol.for('sqlrooms.persist.mergeInput');

const AiProviderModelSchema = z.object({
  modelName: z.string(),
});

const AiProviderSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  models: z.array(AiProviderModelSchema),
});

const AiCustomModelSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  modelName: z.string(),
});

const AiModelParametersSchema = z.object({
  maxSteps: z.number(),
  additionalInstruction: z.string(),
});

const AiSettingsSliceConfigSchema = z.object({
  providers: z.record(
    z.string(), // provider name
    AiProviderSchema,
  ),
  // custom models using provider 'custom'
  customModels: z.array(AiCustomModelSchema),
  modelParameters: AiModelParametersSchema,
});

type AiSettingsProviderConfig = z.infer<typeof AiProviderSchema>;
export type AiSettingsSliceConfig = z.infer<typeof AiSettingsSliceConfigSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mergeProviderModels(
  defaultProvider: AiSettingsProviderConfig,
  persistedProvider: unknown,
) {
  if (
    !isRecord(persistedProvider) ||
    !Array.isArray(persistedProvider.models)
  ) {
    return defaultProvider.models;
  }

  const persistedByModelName = new Map<string, Record<string, unknown>>();
  for (const model of persistedProvider.models) {
    if (!isRecord(model) || typeof model.modelName !== 'string') {
      continue;
    }
    persistedByModelName.set(model.modelName, model);
  }

  // Strict prune: only keep models present in code defaults.
  return defaultProvider.models.map((defaultModel) => {
    const persistedModel = persistedByModelName.get(defaultModel.modelName);
    if (!persistedModel) return defaultModel;
    return {
      ...defaultModel,
      ...persistedModel,
      modelName: defaultModel.modelName,
    };
  });
}

export function mergeAiSettingsWithDefaults(
  defaults: AiSettingsSliceConfig,
  persisted: unknown,
): AiSettingsSliceConfig {
  if (!isRecord(persisted)) {
    return defaults;
  }

  const persistedProviders = isRecord(persisted.providers)
    ? persisted.providers
    : undefined;

  const providers = Object.fromEntries(
    Object.entries(defaults.providers).map(
      ([providerName, defaultProvider]) => {
        const persistedProvider =
          persistedProviders && isRecord(persistedProviders[providerName])
            ? persistedProviders[providerName]
            : undefined;

        return [
          providerName,
          {
            ...defaultProvider,
            baseUrl:
              persistedProvider && typeof persistedProvider.baseUrl === 'string'
                ? persistedProvider.baseUrl
                : defaultProvider.baseUrl,
            apiKey:
              persistedProvider && typeof persistedProvider.apiKey === 'string'
                ? persistedProvider.apiKey
                : defaultProvider.apiKey,
            models: mergeProviderModels(defaultProvider, persistedProvider),
          },
        ];
      },
    ),
  );

  const customModels = AiSettingsSliceConfigSchema.shape.customModels.safeParse(
    persisted.customModels,
  );

  const modelParameters = AiSettingsSliceConfigSchema.shape.modelParameters
    .partial()
    .safeParse(persisted.modelParameters);

  return AiSettingsSliceConfigSchema.parse({
    ...defaults,
    providers,
    customModels: customModels.success
      ? customModels.data
      : defaults.customModels,
    modelParameters: {
      ...defaults.modelParameters,
      ...(modelParameters.success ? modelParameters.data : {}),
    },
  });
}

const MergeAiSettingsInputSchema = z.object({
  defaults: AiSettingsSliceConfigSchema,
  persisted: z.unknown(),
});

export const AiSettingsSliceConfig = z.preprocess((data) => {
  if (isRecord(data)) {
    const mergeInput = MergeAiSettingsInputSchema.safeParse(data);
    if (mergeInput.success) {
      return mergeAiSettingsWithDefaults(
        mergeInput.data.defaults,
        mergeInput.data.persisted,
      );
    }
  }

  return data;
}, AiSettingsSliceConfigSchema);

Object.assign(AiSettingsSliceConfig, {
  /**
   * Opt this schema into defaults-aware rehydrate input.
   *
   * `createPersistHelpers.merge` reads this marker and passes the returned
   * object into this schema's `preprocess`, which handles the merge.
   */
  [PersistMergeInputSymbol]: ({
    defaults,
    persisted,
  }: {
    defaults: unknown;
    persisted: unknown;
  }) => ({
    defaults,
    persisted,
  }),
});
