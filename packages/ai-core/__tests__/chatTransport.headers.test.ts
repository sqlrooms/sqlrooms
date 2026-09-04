import {describe, expect, test} from '@jest/globals';
import {mergeRemoteChatHeaders} from '../src/chatTransport';

describe('remote chat headers', () => {
  test('uses refreshed state headers for an existing transport', () => {
    expect(
      mergeRemoteChatHeaders(
        {Authorization: 'Bearer stale'},
        {Authorization: 'Bearer refreshed'},
        {authorization: 'Bearer stale request', 'x-request': 'request'},
      ),
    ).toEqual({authorization: 'Bearer refreshed', 'x-request': 'request'});
  });
});
