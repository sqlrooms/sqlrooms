/**
 * Lazy loader for the Mosaic JSON schema.
 * The schema is ~8.7MB so we load it on demand and cache it.
 */

const MOSAIC_SCHEMA_URL = 'https://idl.uw.edu/mosaic/schema/latest.json';

let cachedSchema: object | null = null;
let loadingPromise: Promise<object | null> | null = null;

/**
 * Lazily loads the Mosaic JSON schema for editor validation.
 * The schema is fetched from the UW IDL CDN and cached.
 *
 * @returns Promise that resolves to the Mosaic JSON schema, or null if loading failed
 */
export async function loadMosaicSchema(): Promise<object | null> {
  if (cachedSchema) {
    return cachedSchema;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const response = await fetch(MOSAIC_SCHEMA_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      cachedSchema = await response.json();
      return cachedSchema;
    } catch (error) {
      console.warn('Failed to load Mosaic schema from CDN:', error);
      cachedSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        description: 'Mosaic specification (schema loading failed)',
      };
      return cachedSchema;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Synchronously returns cached schema, or null if not yet loaded.
 */
export function getCachedMosaicSchema(): object | null {
  return cachedSchema;
}

/**
 * Preload the schema without waiting for it.
 */
export function preloadMosaicSchema(): void {
  loadMosaicSchema().catch(() => {});
}
