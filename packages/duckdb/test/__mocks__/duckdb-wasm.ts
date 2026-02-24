export const DuckDBDataProtocol = {
  BROWSER_FILEREADER: 0,
  HTTP: 1,
  S3: 2,
};

export const DuckDBAccessMode = {
  AUTOMATIC: 'AUTOMATIC',
  READ_ONLY: 'READ_ONLY',
  READ_WRITE: 'READ_WRITE',
};

export class ConsoleLogger {
  log() {}
}

export class AsyncDuckDB {
  constructor(_logger?: unknown, _worker?: unknown) {}
}

export function getJsDelivrBundles() {
  return {};
}

export async function selectBundle() {
  return {
    mainWorker: '',
    mainModule: '',
  };
}
