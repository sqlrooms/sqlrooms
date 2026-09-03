import {describe, expect, test} from 'vitest';
import {
  DEFAULT_DOCUMENT_TITLE,
  DOCUMENT_ARTIFACT_TYPE,
  migrateLegacyWorksheetArtifacts,
} from './documentTerminology';

describe('workspace document terminology', () => {
  test('uses the CLI app document defaults', () => {
    expect(DOCUMENT_ARTIFACT_TYPE).toBe('document');
    expect(DEFAULT_DOCUMENT_TITLE).toBe('Document');
  });

  test('migrates legacy artifacts when loading', () => {
    const migrated = migrateLegacyWorksheetArtifacts({
      artifacts: {
        artifactsById: {
          legacy: {id: 'legacy', type: 'worksheet', title: 'Worksheet'},
        },
      },
    });

    expect(
      (
        (migrated.artifacts as Record<string, unknown>).artifactsById as Record<
          string,
          unknown
        >
      ).legacy,
    ).toEqual({id: 'legacy', type: 'document', title: 'Document'});
  });
});
