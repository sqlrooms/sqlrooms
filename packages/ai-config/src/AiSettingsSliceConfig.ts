import {z} from 'zod';

/**
 * Shared symbol contract with `@sqlrooms/room-store`'s `createPersistHelpers`.
 *
 * `Symbol.for(...)` keeps this package aligned with `room-store` at runtime
 * without introducing a direct runtime dependency.
 */
const PersistMergeInputSymbol = Symbol.for('sqlrooms.persist.mergeInput');

export const AiProviderAuthMethodType = z.enum([
  'api_key',
  'env_api_key',
  'oauth_auto',
  'oauth_popup',
  'oauth_redirect',
  'oauth_code',
  'device_code',
  'local',
  'external_credentials',
  'oauth_to_api_key',
]);

export const AiProviderAuthMethodSchema = z.object({
  id: z.string(),
  type: AiProviderAuthMethodType,
  label: z.string(),
  description: z.string().optional().default(''),
  experimental: z.boolean().optional().default(false),
  envVar: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional().default({}),
});

export const AiProviderStatusSchema = z.object({
  hasCredentials: z.boolean().optional().default(false),
  credentialType: z.string().nullable().optional(),
  expiresAt: z.number().nullable().optional(),
  selectedAuthMethod: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

const AiProviderModelSchema = z.object({
  modelName: z.string(),
});

export const AiProviderSchema = z.object({
  title: z.string().optional().default(''),
  kind: z.string().optional().default('builtin'),
  baseUrl: z.string(),
  apiKey: z.string().optional(),
  models: z.array(AiProviderModelSchema),
  defaultAuthMethod: z.string().optional(),
  authMethods: z.array(AiProviderAuthMethodSchema).optional().default([]),
  experimental: z.boolean().optional().default(false),
  status: AiProviderStatusSchema.optional(),
  selectedAuthMethod: z.string().nullable().optional(),
  hasCredentials: z.boolean().optional(),
  credentialType: z.string().nullable().optional(),
  expiresAt: z.number().nullable().optional(),
  proxyEnabled: z.boolean().optional(),
  upstreamBaseUrl: z.string().optional(),
  authMethodType: z.string().optional(),
});

const AiCustomModelSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string().optional(),
  modelName: z.string(),
});

const AiModelParametersSchema = z.object({
  maxSteps: z.number(),
  additionalInstruction: z.string(),
});

const AiSettingsSliceConfigSchema = z.object({
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
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
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const persistedModels: Record<string, unknown>[] = [];
  for (const model of persistedProvider.models) {
    if (!isRecord(model) || typeof model.modelName !== 'string') {
      continue;
    }
    persistedModels.push(model);
    persistedByModelName.set(model.modelName, model);
  }

  const defaultModelNames = new Set(
    defaultProvider.models.map((model) => model.modelName),
  );

  return [
    ...defaultProvider.models.map((defaultModel) => {
      const persistedModel = persistedByModelName.get(defaultModel.modelName);
      if (!persistedModel) return defaultModel;
      return {
        ...defaultModel,
        ...persistedModel,
        modelName: defaultModel.modelName,
      };
    }),
    ...persistedModels
      .filter((model) => !defaultModelNames.has(model.modelName as string))
      .map((model) => AiProviderModelSchema.parse(model)),
  ];
}

function mergeProvider(
  defaultProvider: AiSettingsProviderConfig,
  persistedProvider: unknown,
): AiSettingsProviderConfig {
  if (!isRecord(persistedProvider)) {
    return defaultProvider;
  }

  const parsedPartial = AiProviderSchema.partial().safeParse(persistedProvider);
  const persisted = parsedPartial.success ? parsedPartial.data : {};
  return AiProviderSchema.parse({
    ...defaultProvider,
    ...persisted,
    models: mergeProviderModels(defaultProvider, persistedProvider),
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

  const providers = Object.fromEntries([
    ...Object.entries(defaults.providers).map(
      ([providerName, defaultProvider]) => {
        const persistedProvider =
          persistedProviders && isRecord(persistedProviders[providerName])
            ? persistedProviders[providerName]
            : undefined;

        return [
          providerName,
          mergeProvider(defaultProvider, persistedProvider),
        ] as const;
      },
    ),
    ...Object.entries(persistedProviders ?? {})
      .filter(([providerName]) => !(providerName in defaults.providers))
      .flatMap(([providerName, persistedProvider]) => {
        const parsed = AiProviderSchema.safeParse(persistedProvider);
        return parsed.success ? [[providerName, parsed.data] as const] : [];
      }),
  ]);

  const customModels = AiSettingsSliceConfigSchema.shape.customModels.safeParse(
    persisted.customModels,
  );

  const modelParameters = AiSettingsSliceConfigSchema.shape.modelParameters
    .partial()
    .safeParse(persisted.modelParameters);

  return AiSettingsSliceConfigSchema.parse({
    ...defaults,
    defaultProvider:
      typeof persisted.defaultProvider === 'string'
        ? persisted.defaultProvider
        : defaults.defaultProvider,
    defaultModel:
      typeof persisted.defaultModel === 'string'
        ? persisted.defaultModel
        : defaults.defaultModel,
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
