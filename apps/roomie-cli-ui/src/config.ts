import {z} from 'zod';
import {authorizedFetch} from './auth';
const response = await authorizedFetch('/api/config');
if (!response.ok)
  throw new Error(
    'Roomie configuration unavailable. Open a fresh launch link.',
  );
export const config = z
  .object({
    application: z.literal('roomie'),
    schemaVersion: z.literal(1),
    databasePath: z.string(),
    binding: z.string(),
    wsUrl: z.string(),
    bridgeUrl: z.string(),
  })
  .parse(await response.json());
