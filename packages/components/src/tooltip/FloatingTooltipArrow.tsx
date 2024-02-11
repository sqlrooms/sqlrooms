import {useTheme} from '@chakra-ui/react';
import {Coords} from '@floating-ui/react-dom-interactions';
import {opacifyHex} from '@sqlrooms/utils';
import React, {forwardRef, Ref, useMemo} from 'react';

export interface Props {
  arrow: (Partial<Coords> & {centerOffset: number}) | undefined;
  placement: string;
  color?: string;
  size?: number;
  ref: Ref<HTMLElement | null>;
}

export const DEFAULT_ARROW_SIZE = 7;

const FloatingTooltipArrow: React.FC<Props> = forwardRef<
  HTMLElement | null,
  Props
>((props, ref) => {
  const theme = useTheme();
  const {
    arrow,
    placement,
    color = theme.colors.tooltipBgColor,
    size = DEFAULT_ARROW_SIZE,
  } = props;
  const style = useMemo(
    () => getArrowStyle(arrow, placement.split('-')[0], size * 2),
    [arrow, placement, size],
  );
  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      style={{position: 'absolute', ...style}}
    >
      <svg width={size * 2} height={size * 2} viewBox="0 0 10 10">
        <path
          d="M0,-1 10,-1 5,5Z"
          fill={color}
          stroke={opacifyHex(theme.colors.boxShadowColor, 0.25)}
        />
      </svg>
    </div>
  );
});

FloatingTooltipArrow.displayName = 'FloatingTooltipArrow';

function getArrowStyle(arrow: Props['arrow'], placement: string, size: number) {
  const x = arrow?.x ?? 0;
  const y = arrow?.y ?? 0;
  switch (placement) {
    case 'top':
      return {
        left: x,
        bottom: -size,
      };
    case 'bottom':
      return {
        transform: 'rotate(180deg)',
        left: x,
        top: -size,
      };
    case 'left':
      return {
        top: y,
        right: -size,
        transform: 'rotate(-90deg)',
      };
    case 'right':
      return {
        top: y,
        left: -size,
        transform: 'rotate(90deg)',
      };
    default:
      return {};
  }
}

export default FloatingTooltipArrow;
