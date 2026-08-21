/* global module */

const window = globalThis;

module.exports = window;
module.exports.console = globalThis.console;
module.exports.Blob = globalThis.Blob;
module.exports.URL = globalThis.URL;
module.exports.atob = globalThis.atob;
module.exports.Uint8Array = globalThis.Uint8Array;
module.exports.ArrayBuffer = globalThis.ArrayBuffer;
module.exports.document = globalThis.document;
module.exports.requestAnimationFrame = globalThis.requestAnimationFrame;
module.exports.cancelAnimationFrame = globalThis.cancelAnimationFrame;
