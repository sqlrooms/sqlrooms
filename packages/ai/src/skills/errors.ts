/**
 * Structured error types for the skills subsystem. All errors are
 * serializable across process boundaries (plain JSON properties, no
 * circular refs) so that host IPC layers can ferry them verbatim.
 */

export type SkillErrorCode =
  | 'INVALID_MANIFEST'
  | 'NOT_FOUND'
  | 'ROOT_READONLY'
  | 'ID_CONFLICT';

/** A JSON-serializable value (no functions, no undefined, no circular refs). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {[key: string]: JsonValue};

export interface SkillErrorContext {
  /** The ref involved, when applicable. */
  ref?: {rootId: string; id: string};
  /** The root involved, when applicable. */
  rootId?: string;
  /** Zod issue list for manifest validation failures. */
  issues?: Array<{
    path: Array<string | number>;
    message: string;
    code?: string;
  }>;
  /** Free-form additional context — must be JSON-serializable. */
  extras?: Record<string, JsonValue>;
}

export class SkillError extends Error {
  readonly code: SkillErrorCode;
  readonly context?: SkillErrorContext;

  constructor(
    code: SkillErrorCode,
    message: string,
    context?: SkillErrorContext,
  ) {
    super(message);
    this.name = 'SkillError';
    this.code = code;
    this.context = context;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export class SkillManifestError extends SkillError {
  constructor(message: string, context?: SkillErrorContext) {
    super('INVALID_MANIFEST', message, context);
    this.name = 'SkillManifestError';
  }
}

export class SkillNotFoundError extends SkillError {
  constructor(message: string, context?: SkillErrorContext) {
    super('NOT_FOUND', message, context);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillRootReadOnlyError extends SkillError {
  constructor(message: string, context?: SkillErrorContext) {
    super('ROOT_READONLY', message, context);
    this.name = 'SkillRootReadOnlyError';
  }
}

export class SkillConflictError extends SkillError {
  constructor(message: string, context?: SkillErrorContext) {
    super('ID_CONFLICT', message, context);
    this.name = 'SkillConflictError';
  }
}
