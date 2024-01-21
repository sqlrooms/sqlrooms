import {VirtualElement} from '@floating-ui/react-dom-interactions';

export function createVirtualElement(
  container: HTMLElement,
  x: number,
  y: number,
  width: number,
  height: number,
): VirtualElement {
  return {
    getBoundingClientRect() {
      const bb = container.getBoundingClientRect();
      const left = bb.left + x,
        top = bb.top + y;
      const vals = {
        x: left,
        y: top,
        top,
        left,
        bottom: top + height,
        right: left + width,
        width,
        height,
      };
      return {
        ...vals,
      };
    },
  };
}
