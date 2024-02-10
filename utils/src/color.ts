import {color as d3color} from 'd3-color';

export function opacifyHex(hexCode: string, opacity: number): string {
  const c = d3color(hexCode);
  if (!c) {
    console.warn('Invalid color: ', hexCode);
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const col = c.rgb();
  return `rgba(${col.r}, ${col.g}, ${col.b}, ${opacity})`;
}
