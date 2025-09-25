// No imports needed - only exports individual migration functions

/**
 * Migration function to add toolAdditionalData field to analysis sessions.
 *
 * Version: 0.25.0
 * Introduced: Added toolAdditionalData field to persist tool call additional data per session
 *
 * OLD SCHEMA (legacy format):
 * {
 *   id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   baseUrl?: string,
 *   analysisResults: AnalysisResult[],
 *   createdAt?: Date,
 *   uiMessages: UIMessage[]
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *   id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   baseUrl?: string,
 *   analysisResults: AnalysisResult[],
 *   createdAt?: Date,
 *   uiMessages: UIMessage[],
 *   toolAdditionalData?: Record<string, unknown>  // NEW FIELD
 * }
 *
 * Key changes:
 * - Added 'toolAdditionalData' field to store tool call additional data per session
 * - This allows tool call data to be persisted and restored when switching sessions
 */

/**
 * Helper function to detect if data needs migration from v0.25.0 format
 */
function needsV0_25_0Migration(data: unknown): boolean {
  return (
    data !== null && typeof data === 'object' && !('toolAdditionalData' in data)
  );
}

/**
 * Helper function to migrate data from v0.25.0 format
 */
function migrateFromV0_25_0(data: unknown) {
  return {
    ...(data as Record<string, unknown>),
    toolAdditionalData: {},
  };
}

// Export individual migration functions for use in centralized migration
export {needsV0_25_0Migration, migrateFromV0_25_0};
