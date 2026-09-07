import {TextDecoder, TextEncoder} from 'node:util';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  IS_REACT_ACT_ENVIRONMENT: true,
  // jsdom has no Workers. Let browser modules load, but fail if a test starts one.
  Worker: class {
    constructor() {
      throw new Error('Web Workers are unavailable in Deck DOM unit tests.');
    }
  },
});
