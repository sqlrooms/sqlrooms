/**
 * Migration function to add per-session prompt/isRunning fields to AnalysisSession.
 *
 * Version: 0.27.0
 *
 * Changes:
 * - add prompt: string (default '')
 * - add isRunning: boolean (default false)
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
 *   uiMessages?: UIMessageSchema[],
 *   toolAdditionalData?: Record<string, unknown>,
 *   messagesRevision?: number
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *   ...oldFields,
 *   prompt: string,
 *   isRunning: boolean
 * }
 */

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/** Detect if session needs migration to add prompt/isRunning */
function needsV0_27_0Migration(data: unknown): boolean {
  if (!isObject(data)) return false;

  const prompt = data.prompt;
  const isRunning = data.isRunning;

  // Needs migration if either field is missing or not the expected type
  return typeof prompt !== 'string' || typeof isRunning !== 'boolean';
}

/** Perform migration to add prompt/isRunning fields */
function migrateFromV0_27_0(data: unknown) {
  if (!needsV0_27_0Migration(data)) return data;

  const session = {...(data as UnknownRecord)};

  return {
    ...session,
    prompt: typeof session.prompt === 'string' ? session.prompt : '',
    isRunning:
      typeof session.isRunning === 'boolean' ? session.isRunning : false,
  };
}

export {needsV0_27_0Migration, migrateFromV0_27_0};
