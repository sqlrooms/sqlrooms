// Mock for @sqlrooms/utils in test environment
// Only mock the React rendering function, all other exports are noop
export const renderComponentToDomElement = jest.fn(() => {
  const div = document.createElement('div');
  div.textContent = 'Mocked tooltip';
  return div;
});

export const renderComponentToString = jest.fn(() => 'Mocked string');

// Mock getMonospaceFont which is used by tooltip theme
export const getMonospaceFont = jest.fn(() => 'monospace');
