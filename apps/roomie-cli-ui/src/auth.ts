import {createBrowserAuthorization} from '@sqlrooms/mcp/browser-auth';
export const {authorizedFetch, bootstrapAuthorization, pageCredential} =
  createBrowserAuthorization({product: 'roomie', name: 'Roomie'});
