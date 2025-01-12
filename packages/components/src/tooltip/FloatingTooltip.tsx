import {Box, useTheme} from '@chakra-ui/react';
import {
  FloatingPortal,
  ReferenceType,
} from '@floating-ui/react-dom-interactions';
import {ReactNode, useContext} from 'react';
import {AppContext} from '../AppContext';
import FloatingTooltipArrow from './FloatingTooltipArrow';
import {UseFloatingTooltipReturn} from './useFloatingTooltip';

export type Props<
  ContainerElementType extends Element = Element,
  TargetElementType extends ReferenceType = ReferenceType,
> = {
  floatingTooltip: UseFloatingTooltipReturn<
    ContainerElementType,
    TargetElementType
  >;
  children?: ReactNode;
};

function FloatingTooltip<
  ContainerElementType extends Element = Element,
  TargetElementType extends ReferenceType = ReferenceType,
>(props: Props<ContainerElementType, TargetElementType>): React.ReactNode {
  const theme = useTheme();
  const {floatingTooltip, children} = props;
  const {floating, floatingArrowRef} = floatingTooltip;
  const {portalRef} = useContext(AppContext);
  return (
    <FloatingPortal root={portalRef?.current}>
      {children ? (
        <Box
          ref={floating.floating}
          position={floating.strategy}
          left={floating.x ?? 0}
          top={floating.y ?? 0}
          pointerEvents="none"
          bg={theme.colors.tooltipBgColor}
          textColor={theme.colors.textColor}
          boxShadow={`0 0 4px ${theme.colors.boxShadowColor}`}
          borderRadius={4}
          fontSize={11}
          px={2}
          py={2}
        >
          <FloatingTooltipArrow
            ref={floatingArrowRef}
            placement={floating.placement}
            arrow={floating.middlewareData.arrow}
          />
          {children}
        </Box>
      ) : null}
    </FloatingPortal>
  );
}

export default FloatingTooltip;
