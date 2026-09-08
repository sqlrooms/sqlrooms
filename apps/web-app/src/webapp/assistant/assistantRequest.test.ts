import {describe, expect, test, vi} from 'vitest';
import {AuthTokenVerificationError} from '#/lib/authTokenError';
import {authenticateAssistantRequest} from './assistantRequest';

describe('authenticateAssistantRequest', () => {
  test('maps invalid bearer tokens to the structured authentication error', async () => {
    const verifyToken = vi
      .fn()
      .mockRejectedValue(new AuthTokenVerificationError());
    const request = new Request('https://sqlrooms.example/api/chat', {
      headers: {Authorization: 'Bearer expired-token'},
    });

    await expect(
      authenticateAssistantRequest(request, verifyToken),
    ).rejects.toMatchObject({
      message: 'Sign in to use the assistant.',
      status: 401,
      code: 'ASSISTANT_AUTH_REQUIRED',
    });
  });

  test('preserves authentication infrastructure failures', async () => {
    const verifyToken = vi
      .fn()
      .mockRejectedValue(new Error('JWKS unavailable'));
    const request = new Request('https://sqlrooms.example/api/chat', {
      headers: {Authorization: 'Bearer token'},
    });

    await expect(
      authenticateAssistantRequest(request, verifyToken),
    ).rejects.toThrow('JWKS unavailable');
  });
});
