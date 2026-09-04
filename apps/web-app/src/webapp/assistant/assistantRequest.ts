export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function authenticateAssistantRequest(
  request: Request,
  verifyToken: (token: string) => Promise<{userId: string}>,
) {
  const token = readBearerToken(request);
  try {
    return await verifyToken(token);
  } catch (error) {
    if (error instanceof AuthTokenVerificationError) {
      throw authenticationRequired();
    }
    throw error;
  }
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw authenticationRequired();
  return match[1];
}

function authenticationRequired() {
  return new AssistantError(
    'Sign in to use the assistant.',
    401,
    'ASSISTANT_AUTH_REQUIRED',
  );
}
import {AuthTokenVerificationError} from '#/lib/authTokenError';
