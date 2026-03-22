import {DbConnection} from '@sqlrooms/db';
import {z} from 'zod';

/**
 * Diagnostic info about a connector driver's availability.
 */
export const ConnectorDriverDiagnostic = z.object({
  id: z.string(),
  engineId: z.string(),
  title: z.string(),
  available: z.boolean(),
  error: z.string().optional(),
  reason: z.string().optional(),
  requiredPackages: z.array(z.string()).optional(),
  installCommands: z
    .object({
      uvProject: z.string().optional(),
      uvxRelaunch: z.string().optional(),
      uvxWith: z.string().optional(),
    })
    .optional(),
});
export type ConnectorDriverDiagnostic = z.infer<
  typeof ConnectorDriverDiagnostic
>;

/**
 * Persisted configuration for the DB settings slice.
 */
export const DbSettingsSliceConfig = z.object({
  connections: z.array(DbConnection).default([]),
  diagnostics: z.array(ConnectorDriverDiagnostic).default([]),
});
export type DbSettingsSliceConfig = z.infer<typeof DbSettingsSliceConfig>;
