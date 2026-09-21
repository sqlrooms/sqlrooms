export const TOOL_CALL_CANCELLED = 'Tool call cancelled by user';

export const ABORT_EVENT = 'abort';

export const SESSION_DELETED = 'Analysis cancelled - session was deleted';

export const ANALYSIS_CANCELLED = 'Analysis cancelled';

/**
 * What {@link AiSliceState.ai.sendPrompt} resolves with when the underlying
 * model call fails. It reports failure by value rather than by throwing, so a
 * caller that renders the response as content or as a name has to recognise
 * this string — otherwise the placeholder is indistinguishable from a real
 * answer. Compare against this constant rather than the literal.
 */
export const AI_GENERATION_FAILED_TEXT = 'error: can not generate response';
