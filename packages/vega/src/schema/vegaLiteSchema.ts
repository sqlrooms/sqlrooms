/**
 * Lazy loader for the Vega-Lite JSON schema.
 * The schema is ~1.8MB so we load it on demand and cache it.
 */

// Vega-Lite v5 schema URL from CDN
const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v5.json';

let cachedSchema: object | null = null;
let loadingPromise: Promise<object | null> | null = null;

/**
 * Lazily loads the Vega-Lite JSON schema for Monaco editor validation.
 * The schema is fetched from the Vega GitHub Pages CDN and cached.
 *
 * @returns Promise that resolves to the Vega-Lite JSON schema, or null if loading failed
 */
export async function loadVegaLiteSchema(): Promise<object | null> {
  // Return cached schema if available
  if (cachedSchema) {
    return cachedSchema;
  }

  // If already loading, return the existing promise
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    try {
      // Fetch the schema from the Vega CDN
      const response = await fetch(VEGA_LITE_SCHEMA_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      cachedSchema = await response.json();
      return cachedSchema;
    } catch (error) {
      console.warn('Failed to load Vega-Lite schema from CDN:', error);
      // Return minimal fallback schema
      cachedSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        description: 'Vega-Lite specification (schema loading failed)',
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
 * Use loadVegaLiteSchema() to ensure the schema is loaded.
 */
export function getCachedVegaLiteSchema(): object | null {
  return cachedSchema;
}

/**
 * Preload the schema without waiting for it.
 * Useful for warming up the cache on app startup.
 */
export function preloadVegaLiteSchema(): void {
  loadVegaLiteSchema().catch(() => {
    // Silently ignore preload errors
  });
}
