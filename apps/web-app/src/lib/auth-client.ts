import {createInternalNeonAuth} from '@neondatabase/auth';
import {BetterAuthReactAdapter} from '@neondatabase/auth/react/adapters';

const authBaseUrl = import.meta.env.VITE_NEON_AUTH_BASE_URL as
  | string
  | undefined;

type AuthSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  session: {id: string; userId: string};
};

type AuthClient = {
  useSession: () => {
    data: AuthSession | null;
    isPending: boolean;
    refetch: () => Promise<void>;
  };
  getSession: () => Promise<{data: AuthSession | null}>;
  signIn: {
    social: (input: {
      provider: 'google';
      callbackURL?: string;
      newUserCallbackURL?: string;
      errorCallbackURL?: string;
    }) => Promise<{error?: {message?: string} | null}>;
  };
  signOut: () => Promise<unknown>;
};

const unavailableAuthClient: AuthClient = {
  useSession: () => ({
    data: null,
    isPending: false,
    refetch: async () => {},
  }),
  getSession: async () => ({data: null}),
  signIn: {
    social: async () => ({
      error: {message: 'VITE_NEON_AUTH_BASE_URL is not configured.'},
    }),
  },
  signOut: async () => {},
};

export const neonAuth = authBaseUrl
  ? createInternalNeonAuth(authBaseUrl, {
      adapter: BetterAuthReactAdapter(),
    })
  : null;

export const authClient = neonAuth
  ? (neonAuth.adapter as unknown as AuthClient)
  : unavailableAuthClient;

export async function getNeonJWTToken() {
  if (!neonAuth) return null;
  return neonAuth.getJWTToken();
}
