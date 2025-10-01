// No imports needed - only exports individual migration functions

/**
 * Migration function to convert old analysis session format to new format.
 *
 * Version: 0.24.14
 * Introduced: Migration from 'ollamaBaseUrl' to 'baseUrl' field
 *
 * OLD SCHEMA (legacy format):
 * {
 *   id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   ollamaBaseUrl?: string,  // OLD FIELD
 *   analysisResults: AnalysisResult[],
 *   createdAt?: Date
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *   id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   baseUrl?: string,  // NEW FIELD
 *   analysisResults: AnalysisResult[],
 *   createdAt?: Date
 * }
 *
 * Key changes:
 * - Renamed 'ollamaBaseUrl' field to 'baseUrl' for better generic naming
 * - The field serves the same purpose but with a more provider-agnostic name
 */

/**
 * Helper function to detect if data needs migration from v0.24.14 format
 */
function needsV0_24_14Migration(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    'ollamaBaseUrl' in data &&
    !('baseUrl' in data)
  );
}

/**
 * Helper function to migrate data from v0.24.14 format
 */
function migrateFromV0_24_14(data: unknown) {
  // migrate from old ollamaBaseUrl to new baseUrl
  const {ollamaBaseUrl, ...rest} = data as {ollamaBaseUrl: string} & Record<
    string,
    unknown
  >;
  return {
    ...rest,
    baseUrl: ollamaBaseUrl,
  };
}

// Export individual migration functions for use in centralized migration
export {needsV0_24_14Migration, migrateFromV0_24_14};
