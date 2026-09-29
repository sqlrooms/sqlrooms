import {createBrowserAuthorization} from '@sqlrooms/mcp/browser-auth';
export type {BrowserAuthorization} from '@sqlrooms/mcp/browser-auth';

export const {
  instancePath,
  authorizationHeaders,
  authorizedFetch,
  bootstrapAuthorization,
  pageCredential,
} = createBrowserAuthorization({product: 'sqlrooms', name: 'SQLRooms'});
