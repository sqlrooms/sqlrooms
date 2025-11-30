import {z} from 'zod';

export const AiSettingsSliceConfig = z.object({
  providers: z.record(
    z.string(), // provider name
    z.object({
      baseUrl: z.string(),
      apiKey: z.string(),
      models: z.array(
        z.object({
          modelName: z.string(),
        }),
      ),
    }),
  ),
  // custom models using provider 'custom'
  customModels: z.array(
    z.object({
      baseUrl: z.string(),
      apiKey: z.string(),
      modelName: z.string(),
    }),
  ),
  modelParameters: z.object({
    maxSteps: z.number(),
    additionalInstruction: z.string(),
  }),
});

export type AiSettingsSliceConfig = z.infer<typeof AiSettingsSliceConfig>;
