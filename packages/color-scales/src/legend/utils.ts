export type LegendTick = {label: string; offset: number};

export function rgba(color: [number, number, number, number]) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

export function getRampStyle(width: number) {
  return {
    width,
    maxWidth: '100%',
  };
}
