import {createBrowserAuthorization} from '@sqlrooms/mcp/browser-auth';
/** Node uses the shared sqlrooms-ticket bootstrap contract. */
export const {authorizedFetch, bootstrapAuthorization, pageCredential} =
  createBrowserAuthorization({
    product: 'sqlrooms',
    name: 'Roomie',
    credentials: 'same-origin',
    gatewayAuth: true,
    credentialHeader: 'x-sqlrooms-token',
  });
