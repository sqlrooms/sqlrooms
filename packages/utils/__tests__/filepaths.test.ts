import {
  generateUniqueName,
  generateUniquePath,
  convertToUniqueS3ObjectName,
} from '../src/filepaths';

test('generateUniqueName generates unique table names', () => {
  expect(generateUniqueName('foo', [])).toBe('foo');
  expect(generateUniqueName('foo', ['345'])).toBe('foo');
  expect(generateUniqueName('foo', ['foo_1'])).toBe('foo');
  expect(generateUniqueName('foo', ['foo', 'foo_1'])).toBe('foo_2');
  expect(generateUniqueName('foo_1', ['foo_1'])).toBe('foo_2');
  expect(generateUniqueName('foo_2', ['foo_2'])).toBe('foo_3');
  expect(generateUniqueName('foo', ['foo', 'foo_1', 'foo_2'])).toBe('foo_3');
  expect(generateUniqueName('')).toBe('');
  expect(generateUniqueName('', [''])).toBe('_1');
  expect(generateUniqueName('_', ['_'])).toBe('__1');
});

test('generateUniqueName with space separator', () => {
  expect(generateUniqueName('Notebook 1', [], ' ')).toBe('Notebook 1');
  expect(generateUniqueName('Notebook 1', ['Notebook 1'], ' ')).toBe(
    'Notebook 2',
  );
  expect(generateUniqueName('Untitled 1', ['Untitled 1'], ' ')).toBe(
    'Untitled 2',
  );
  expect(
    generateUniqueName('Untitled 1', ['Untitled 1', 'Untitled 2'], ' '),
  ).toBe('Untitled 3');
});

test('generateUniquePath generates unique paths', () => {
  expect(generateUniquePath('/foo/bar.csv', [])).toBe('/foo/bar.csv');
  expect(generateUniquePath('/foo/bar.csv', ['345'])).toBe('/foo/bar.csv');
  expect(generateUniquePath('/foo/bar.csv', ['/foo/bar.csv'])).toBe(
    '/foo/bar_1.csv',
  );
  expect(generateUniquePath('/foo/bar.csv', ['/foo/bar_1.csv'])).toBe(
    '/foo/bar.csv',
  );
  expect(
    generateUniquePath('/foo/bar.csv', ['/foo/bar.csv', '/foo/bar_1.csv']),
  ).toBe('/foo/bar_2.csv');
  expect(
    generateUniquePath('/foo/bar.csv', [
      '/foo/bar.csv',
      '/foo/bar_1.csv',
      '/foo/bar_2.csv',
    ]),
  ).toBe('/foo/bar_3.csv');
  expect(generateUniquePath('/foo/bar_1.csv', ['/foo/bar_1.csv'])).toBe(
    '/foo/bar_2.csv',
  );
  expect(generateUniquePath('/foo/bar_2.csv', ['/foo/bar_2.csv'])).toBe(
    '/foo/bar_3.csv',
  );
  expect(generateUniquePath('/foo', [])).toBe('/foo');
  expect(generateUniquePath('/foo/bar', [])).toBe('/foo/bar');
  expect(generateUniquePath('/foo/bar', ['/foo/bar'])).toBe('/foo/bar_1');
  expect(generateUniquePath('/', [])).toBe('/');
  expect(generateUniquePath('', [])).toBe('');
  expect(generateUniquePath('', [''])).toBe('_1');
  expect(generateUniquePath('_', ['_'])).toBe('__1');
});

test('convertToUniqueS3ObjectName works correctly', () => {
  expect(convertToUniqueS3ObjectName('/flows.csv', [])).toBe('_flows.csv');
  expect(convertToUniqueS3ObjectName('&flows.csv', [])).toBe('_flows.csv');
  expect(convertToUniqueS3ObjectName('@flows.csv', [])).toBe('_flows.csv');
  expect(convertToUniqueS3ObjectName('/flows.csv', [])).toBe('_flows.csv');
  expect(convertToUniqueS3ObjectName('flows.csv', ['flows.csv'])).toBe(
    'flows_1.csv',
  );
  expect(
    convertToUniqueS3ObjectName('flows.csv', ['flows.csv', 'flows_1.csv']),
  ).toBe('flows_2.csv');
});
