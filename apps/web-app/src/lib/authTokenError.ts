export class AuthTokenVerificationError extends Error {
  constructor(options?: ErrorOptions) {
    super('Auth token verification failed.', options);
  }
}
