import {IconProps} from '@chakra-ui/icon';
import {AccordionIcon, Box} from '@chakra-ui/react';

export type AccordionIconProps = IconProps;

function CustomAccordionIcon(props: AccordionIconProps) {
  return (
    <Box
      as="div"
      transform="translate(0,-2px)"
      //transform="scale(1,-1)translate(0,-2px)"
    >
      <AccordionIcon {...props} color={'gray.400'} />
    </Box>
  );
}

CustomAccordionIcon.displayName = 'AccordionIcon';

export default CustomAccordionIcon;
