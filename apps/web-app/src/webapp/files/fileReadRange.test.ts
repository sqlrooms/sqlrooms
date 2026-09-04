import {describe, expect, it} from 'vitest';
import {parseByteRangeHeader} from './fileReadRange';

describe('parseByteRangeHeader', () => {
  it('parses bounded byte ranges', () => {
    expect(parseByteRangeHeader('bytes=10-19', 100)).toEqual({
      range: {offset: 10, length: 10},
      contentRange: 'bytes 10-19/100',
    });
  });

  it('bounds overlong byte ranges to the file size', () => {
    expect(parseByteRangeHeader('bytes=90-120', 100)).toEqual({
      range: {offset: 90, length: 10},
      contentRange: 'bytes 90-99/100',
    });
  });

  it('parses open-ended byte ranges', () => {
    expect(parseByteRangeHeader('bytes=40-', 100)).toEqual({
      range: {offset: 40},
      contentRange: 'bytes 40-99/100',
    });
  });

  it('parses suffix byte ranges', () => {
    expect(parseByteRangeHeader('bytes=-20', 100)).toEqual({
      range: {offset: 80, length: 20},
      contentRange: 'bytes 80-99/100',
    });
  });

  it('rejects invalid ranges', () => {
    expect(parseByteRangeHeader('items=0-10', 100)).toBeNull();
    expect(parseByteRangeHeader('bytes=50-10', 100)).toBeNull();
    expect(parseByteRangeHeader('bytes=100-101', 100)).toBeNull();
  });
});
