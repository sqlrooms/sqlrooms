import {buildKnowledgeIndex} from '../src';

describe('buildKnowledgeIndex', () => {
  it('resolves wikilinks and records backlinks', () => {
    const index = buildKnowledgeIndex({
      artifacts: {
        artifactsById: {
          a: {id: 'a', type: 'document', title: 'Alpha'},
          b: {id: 'b', type: 'document', title: 'Beta'},
        },
        artifactOrder: ['a', 'b'],
      },
      documents: {
        artifacts: {
          a: {id: 'a', markdown: 'See [[Beta]].', updatedAt: 0},
          b: {id: 'b', markdown: '', updatedAt: 0},
        },
      },
    });

    expect(index.linksByArtifactId.a).toEqual([
      {
        sourceArtifactId: 'a',
        sourceTitle: 'Alpha',
        targetArtifactId: 'b',
        targetTitle: 'Beta',
      },
    ]);
    expect(index.backlinksByArtifactId.b).toEqual(index.linksByArtifactId.a);
    expect(index.unresolvedLinks).toEqual([]);
  });

  it('records missing and duplicate-title links as unresolved', () => {
    const index = buildKnowledgeIndex({
      artifacts: {
        artifactsById: {
          a: {id: 'a', type: 'document', title: 'Alpha'},
          b: {id: 'b', type: 'document', title: 'Duplicate'},
          c: {id: 'c', type: 'document', title: 'Duplicate'},
        },
        artifactOrder: ['a', 'b', 'c'],
      },
      documents: {
        artifacts: {
          a: {
            id: 'a',
            markdown: 'See [[Missing]] and [[Duplicate]].',
            updatedAt: 0,
          },
        },
      },
    });

    expect(index.linksByArtifactId.a).toEqual([]);
    expect(index.unresolvedLinks).toEqual([
      {
        sourceArtifactId: 'a',
        sourceTitle: 'Alpha',
        targetTitle: 'Missing',
        reason: 'missing',
      },
      {
        sourceArtifactId: 'a',
        sourceTitle: 'Alpha',
        targetTitle: 'Duplicate',
        reason: 'ambiguous',
      },
    ]);
  });

  it('extracts body hashtags and frontmatter tags', () => {
    const index = buildKnowledgeIndex({
      artifacts: {
        artifactsById: {
          a: {id: 'a', type: 'document', title: 'Alpha'},
        },
        artifactOrder: ['a'],
      },
      documents: {
        artifacts: {
          a: {
            id: 'a',
            markdown:
              '---\ntags:\n  - metrics\n  - sql\n---\n# Heading\nBody #analytics and #sql.',
            updatedAt: 0,
          },
        },
      },
    });

    expect(index.tagsByArtifactId.a).toEqual([
      {artifactId: 'a', title: 'Alpha', tag: 'analytics'},
      {artifactId: 'a', title: 'Alpha', tag: 'metrics'},
      {artifactId: 'a', title: 'Alpha', tag: 'sql'},
    ]);
  });
});
