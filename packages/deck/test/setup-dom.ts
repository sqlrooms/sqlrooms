import {TextDecoder, TextEncoder} from 'node:util';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  IS_REACT_ACT_ENVIRONMENT: true,
});
