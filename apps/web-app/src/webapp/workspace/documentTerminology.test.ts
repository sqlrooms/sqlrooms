import {describe, expect, test} from 'vitest';
import {
  DEFAULT_DOCUMENT_TITLE,
  DOCUMENT_ARTIFACT_TYPE,
} from './documentTerminology';

describe('workspace document terminology', () => {
  test('uses the CLI app document defaults', () => {
    expect(DOCUMENT_ARTIFACT_TYPE).toBe('document');
    expect(DEFAULT_DOCUMENT_TITLE).toBe('Document');
  });
});
