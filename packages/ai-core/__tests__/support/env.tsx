/**
 * Browser globals the composer and suggestions trees touch but jsdom does not
 * provide. Importing this module installs them as a side effect.
 *
 * jsdom-only — every consumer declares `@jest-environment jsdom`.
 */
import {jest} from '@jest/globals';
import {TransformStream} from 'node:stream/web';
import {TextEncoder, TextDecoder} from 'node:util';

/** The auto-resize hook observes its textarea; jsdom has no ResizeObserver. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  TransformStream,
  TextEncoder,
  TextDecoder,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

// Radix scrolls the active item into view; jsdom leaves this unimplemented.
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});
