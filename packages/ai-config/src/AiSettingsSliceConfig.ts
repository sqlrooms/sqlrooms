import {z} from 'zod';

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

export const AiProviderSchema = z.object({
  title: z.string().optional().default(''),
  kind: z.string().optional().default('builtin'),
  baseUrl: z.string(),
  models: z.array(
    z.object({
      modelName: z.string(),
    }),
  ),
  defaultAuthMethod: z.string().optional(),
  authMethods: z.array(AiProviderAuthMethodSchema).optional().default([]),
  experimental: z.boolean().optional().default(false),
  status: AiProviderStatusSchema.optional(),
});

export const AiSettingsSliceConfig = z.object({
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  providers: z.record(
    z.string(), // provider name
    AiProviderSchema,
  ),
  // custom models using provider 'custom'
  customModels: z.array(
    z.object({
      baseUrl: z.string(),
      modelName: z.string(),
    }),
  ),
  modelParameters: z.object({
    maxSteps: z.number(),
    additionalInstruction: z.string(),
  }),
});

export type AiSettingsSliceConfig = z.infer<typeof AiSettingsSliceConfig>;
