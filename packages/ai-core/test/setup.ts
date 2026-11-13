import {TextDecoder, TextEncoder} from 'node:util';

globalThis.TextDecoder ??= TextDecoder;
globalThis.TextEncoder ??= TextEncoder;
