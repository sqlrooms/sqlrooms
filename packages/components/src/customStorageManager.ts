// This is to prevent Chakra UI from storing color mode in localStorage
const customStorageManager = (clean: boolean) => ({
  type: 'localStorage' as const,
  get: () => 'dark' as const, // Always return dark for the initial color mode.
  set: () => {
    window.localStorage.removeItem('chakra-ui-color-mode');
    if (clean) {
      document.body.classList.remove('chakra-ui-dark');
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.removeProperty('color-scheme');
    }
  },
});

export default customStorageManager;
