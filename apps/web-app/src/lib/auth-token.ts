import {sql} from 'drizzle-orm';
import {createLocalJWKSet, createRemoteJWKSet, jwtVerify} from 'jose';
import type {JWK} from 'jose';
import {db} from '#/db/index';

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let localJwks: ReturnType<typeof createLocalJWKSet> | undefined;

export async function verifyAuthToken(token: string) {
  const authJwks = await getAuthJwks();
  const {payload} = await jwtVerify(token, authJwks);
  const userId = payload.sub;

  if (!userId) {
    throw new Error('Auth token is missing a subject');
  }

  return {userId};
}

async function getAuthJwks() {
  if (localJwks) return localJwks;

  const result = await db.execute<{
    id: string;
    publicKey: string;
  }>(sql`select id, "publicKey" from neon_auth.jwks`);

  if (result.rows.length > 0) {
    localJwks = createLocalJWKSet({
      keys: result.rows.map((row) => ({
        ...(JSON.parse(row.publicKey) as JWK),
        alg: 'EdDSA',
        kid: row.id,
      })),
    });
    return localJwks;
  }

  if (!process.env.NEON_AUTH_JWKS_URL) {
    throw new Error('NEON_AUTH_JWKS_URL is required');
  }

  remoteJwks ??= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  return remoteJwks;
}
