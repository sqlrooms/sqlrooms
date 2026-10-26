import {describe, expect, it} from '@jest/globals';
import {Workspace} from '../model';
import {parseContentWorkspace, mergeRoomieContent} from '../contentPersistence';
import {pruneViewState} from '../browserViewState';
import type {RoomState} from '../RoomState';

const legacy = () =>
  Workspace.parse({
    application: 'roomie',
    schemaVersion: 1,
    artifacts: {
      artifactsById: {
        report: {id: 'report', type: 'block-document', title: 'Fresh content'},
      },
      artifactOrder: ['report'],
      currentArtifactId: 'report',
      pinnedArtifactIds: ['report'],
    },
    blockDocuments: {
      artifacts: {report: {id: 'report', content: {type: 'doc', content: []}}},
    },
    mosaicDashboard: {},
    htmlApps: {},
    tableExplorers: {byId: {old: {pageSize: 100}}},
  });

describe('Roomie content/view persistence split', () => {
  it('imports legacy content but drops legacy view fields and accepts version 2', () => {
    const content = parseContentWorkspace(legacy());
    expect(content.artifacts).not.toHaveProperty('currentArtifactId');
    expect(content.artifacts).not.toHaveProperty('pinnedArtifactIds');
    expect(content).not.toHaveProperty('tableExplorers');
    expect(
      parseContentWorkspace({
        ...content,
        application: 'roomie',
        schemaVersion: 2,
      }),
    ).toEqual(content);
    expect(() =>
      parseContentWorkspace({
        ...content,
        application: 'roomie',
        schemaVersion: 3,
      }),
    ).toThrow();
  });

  it('keeps document validation in the content-only envelope', () => {
    const content = parseContentWorkspace(legacy());
    content.blockDocuments.artifacts = {};
    expect(() =>
      parseContentWorkspace({
        ...content,
        application: 'roomie',
        schemaVersion: 2,
      }),
    ).toThrow('Missing document content');
  });

  it('stale local state cannot override content and removed references are dropped', () => {
    const content = parseContentWorkspace(legacy());
    const view = pruneViewState(
      {
        artifacts: {
          currentArtifactId: 'deleted',
          pinnedArtifactIds: ['deleted', 'report'],
          artifactsById: {report: {title: 'STALE'}},
        },
        tableExplorers: {byId: {removedTable: {pageSize: 100}}},
        blockDocuments: {artifacts: {report: {content: 'STALE'}}},
      },
      content,
    );
    expect(view).toEqual({
      artifacts: {currentArtifactId: 'report', pinnedArtifactIds: ['report']},
      tableExplorers: {byId: {}},
    });
    const current = {
      artifacts: {
        config: {currentArtifactId: 'report', pinnedArtifactIds: ['report']},
      },
      blockDocuments: {},
      mosaicDashboard: {},
      htmlApps: {},
    } as unknown as RoomState;
    const merged = mergeRoomieContent(current, content);
    expect(merged.artifacts.config.currentArtifactId).toBe('report');
    expect(merged.artifacts.config.artifactsById.report.title).toBe(
      'Fresh content',
    );
  });
});
