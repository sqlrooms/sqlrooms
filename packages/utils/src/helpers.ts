import {timeFormat} from 'd3-time-format';
import {alea} from 'seedrandom';

import dayjs, {ConfigType} from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const toDateTime = (secs: number) => {
  const t = new Date('1970-01-01T00:30:00Z'); // Unix epoch start.
  t.setSeconds(secs);
  return t;
};

export function genRandomStr(length: number, seed?: string) {
  const rnd = seed ? alea(seed) : Math.random;
  return Array.from(
    (function* () {
      for (let i = 0; i < length; i++) {
        const v = Math.floor(rnd() * (26 * 2 + 10));
        if (v < 26) {
          yield String.fromCharCode(v + 65); // 'A' - 'Z'
        } else if (v < 52) {
          yield String.fromCharCode(v + 71); // 'a' - 'z'
        } else {
          yield String.fromCharCode(v + 48); // '0' - '9'
        }
      }
    })(),
  ).join('');
}

export const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
});

export const formatNumber = NUMBER_FORMAT.format;

const DATE_TIME_FORMAT_ISO = timeFormat('%Y-%m-%d %H:%M:%S');
const DATE_FORMAT_ISO = timeFormat('%Y-%m-%d');

export const formatDateTime = (d: Date | number) => {
  const date = d instanceof Date ? d : new Date(d);
  // return date.toISOString();
  return DATE_TIME_FORMAT_ISO(date);
};

export const formatDate = (d: Date | number) => {
  const date = d instanceof Date ? d : new Date(d);
  return DATE_FORMAT_ISO(date);
};

export const formatTimeRelative = (d: ConfigType) => {
  return dayjs().to(d);
};

export const getErrorMessageForDisplay = (e: any) => {
  let msg = e instanceof Error ? e.message : String(e);
  msg = msg.replace(/Query failed: Error: /, '');
  const firstNl = msg.indexOf('\n');
  return firstNl >= 0 ? msg.substring(0, firstNl) : msg;
};
