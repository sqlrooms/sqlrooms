/**
 * Error thrown by AI agents when validation or execution fails.
 * Used for reporting issues like missing tables, invalid columns, or constraint violations.
 */
export class AiAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAgentError';
  }
}
