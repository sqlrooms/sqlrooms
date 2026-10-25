import {bootstrapAuthorization} from './auth';
try {
  await bootstrapAuthorization();
  await import('./view');
} catch (error) {
  document.getElementById('root')!.textContent =
    error instanceof Error ? error.message : 'Open a fresh Roomie launch link.';
}
