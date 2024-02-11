import * as d3Format from 'd3-format';

export const formatCount = d3Format.format(',.0f');
export const formatCount4 = d3Format.format('.4~s');
export const formatCountShort = d3Format.format(',.0s');

export function shorten(str: string, maxLength = 10): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.substring(0, maxLength - 3)}…`;
}
