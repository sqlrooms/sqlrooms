import * as arrow from 'apache-arrow';
import {valueToString} from '../src/ArrowCellValue';

function getArrowValue(type: arrow.DataType, value: unknown): unknown {
  return arrow.vectorFromArray([value], type).get(0);
}

describe('valueToString', () => {
  it.each([
    new arrow.TimestampSecond(),
    new arrow.TimestampMillisecond(),
    new arrow.TimestampMicrosecond(),
    new arrow.TimestampNanosecond(),
  ])('formats %s values returned by Arrow as epoch milliseconds', (type) => {
    const timestampMs = Date.parse('2026-06-01T21:15:42.000Z');
    const value = getArrowValue(type, timestampMs);

    expect(valueToString(type, value)).toBe('2026-06-01T21:15:42.000Z');
  });

  it('formats DateDay values returned by Arrow as epoch milliseconds', () => {
    const type = new arrow.DateDay();
    const value = getArrowValue(type, Date.parse('2024-02-05T00:00:00.000Z'));

    expect(valueToString(type, value)).toBe('2024-02-05');
  });

  it('still formats time values according to their storage unit', () => {
    const type = new arrow.TimeMicrosecond();

    expect(valueToString(type, 45_000_000_000n)).toBe('12:30:00');
  });
});
