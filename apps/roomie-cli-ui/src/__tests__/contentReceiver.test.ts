import {expect, it, jest} from '@jest/globals';
import {createContentReceiver} from '../node/contentReceiver';
it('a delayed HTTP response cannot replace newer WebSocket content or resurrect a deleted document', () => {
  const apply = jest.fn();
  const receive = createContentReceiver(1, apply);
  receive('new websocket', {doc: 3}, 3);
  receive('old GET', {doc: 2}, 2);
  receive('deletion', {}, 4);
  receive('duplicate old', {doc: 3}, 3);
  expect(apply.mock.calls).toEqual([
    ['new websocket', {doc: 3}],
    ['deletion', {}],
  ]);
});
