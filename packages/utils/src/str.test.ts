import { camelCaseToTitle } from './str';

test('camelCaseToTitle works as expected', () => {
  expect(camelCaseToTitle('myVariableName')).toBe('My Variable Name');
  expect(camelCaseToTitle('URL')).toBe('URL');
  expect(camelCaseToTitle('getHTTPResponse')).toBe('Get HTTP Response');
});
