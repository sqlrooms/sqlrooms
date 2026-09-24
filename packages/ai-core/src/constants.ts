export const TOOL_CALL_CANCELLED = 'Tool call cancelled by user';

export const ABORT_EVENT = 'abort';

export const SESSION_DELETED = 'Analysis cancelled - session was deleted';

export const ANALYSIS_CANCELLED = 'Analysis cancelled';

/**
 * What `ai.sendPrompt` resolves with when the underlying model call fails. It
 * reports failure by value rather than by throwing, which is why `sendPrompt`
 * also takes an `onError` callback: callers should detect failure through that
 * rather than by comparing against this text, which is internal to the package
 * and free to change.
 */
export const AI_GENERATION_FAILED_TEXT = 'error: can not generate response';
