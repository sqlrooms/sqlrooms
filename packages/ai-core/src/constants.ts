/**
 * Shared AI defaults used across ai-core.
 * Set to 1.0 to allow for more creative and exploratory responses
 * NOTE: For GPT models, when reasoningEffort is set you should manually set the temperature to 1.0; this is not enforced automatically.
 * Set to 0.0 to allow for more precise and deterministic responses
 */
export const AI_DEFAULT_TEMPERATURE = 0.0;

export const TOOL_CALL_CANCELLED = 'Tool call cancelled by user';

export const ABORT_EVENT = 'abort';

export const SESSION_DELETED = 'Session deleted';

export const ANALYSIS_PENDING_ID = '__pending__';
