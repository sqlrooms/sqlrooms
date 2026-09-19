import {bootstrapAuthorization} from './browserAuth';

try {
  await bootstrapAuthorization();
  await import('./main');
} catch {
  const root = document.getElementById('root');
  if (root) {
    root.textContent =
      'SQLRooms authorization is required or the server is unavailable. Open a fresh, temporary launch link from the SQLRooms terminal or an authorized local client.';
    root.style.cssText =
      'font: 16px system-ui; max-width: 42rem; margin: 15vh auto; padding: 2rem; line-height: 1.6';
  }
}
