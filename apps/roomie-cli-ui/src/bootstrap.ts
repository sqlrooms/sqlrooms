import {bootstrapAuthorization} from './auth';
try {
  await bootstrapAuthorization();
  await import('./main');
} catch (error) {
  const root = document.getElementById('root')!;
  root.textContent =
    error instanceof Error
      ? error.message
      : 'Roomie authorization required. Open a fresh launch link from the terminal or agent.';
  root.style.cssText =
    'font:16px system-ui;max-width:42rem;margin:15vh auto;padding:2rem;line-height:1.6';
}
