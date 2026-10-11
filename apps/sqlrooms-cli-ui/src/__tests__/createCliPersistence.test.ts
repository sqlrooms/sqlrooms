import {expect, it} from '@jest/globals';
import {z} from 'zod';
import {createCliPersistence} from '../createCliPersistence';

const schemas = {
  room: z.object({title: z.string()}),
  ai: z.object({sessions: z.array(z.object({id: z.string()}))}),
  aiSettings: z.object({providers: z.record(z.string(), z.unknown())}),
  artifactAi: z.object({sessionArtifactLinks: z.array(z.unknown())}),
};
const saved = {
  room: {title: 'Before'},
  ai: {sessions: [{id: 'kept'}]},
  aiSettings: {providers: {example: {model: 'kept'}}},
  artifactAi: {sessionArtifactLinks: [{sessionId: 'kept', artifactId: 'doc'}]},
};
it('keeps dormant conversations/settings through external edits without composing AI slices', () => {
  const helpers = createCliPersistence(schemas, true);
  const state = helpers.merge(saved, {room: {config: {title: 'Default'}}});
  for (const key of ['ai', 'aiSettings', 'artifactAi'])
    expect(state).not.toHaveProperty(key);
  state.room.config.title = 'Edited externally';
  const snapshot = helpers.partialize(state);
  expect(snapshot).toEqual({...saved, room: {title: 'Edited externally'}});
  const restored = createCliPersistence(schemas, false).merge(snapshot, {
    ai: {realMethod: true},
  });
  expect(restored.ai).toEqual({realMethod: true, config: saved.ai});
});
it('does not invent AI config in a new external workspace and rejects invalid saved config', () => {
  const helpers = createCliPersistence(schemas, true);
  expect(helpers.partialize({room: {config: {title: 'New'}}})).toEqual({
    room: {title: 'New'},
  });
  expect(() =>
    helpers.merge({...saved, ai: {sessions: 'broken'}}, {}),
  ).toThrow();
});
