import {Flex} from '@chakra-ui/react';
import {FlexProps} from '@chakra-ui/layout';

const Fullbox: React.FC<FlexProps> = (props) => {
  return (
    <Flex
      position="absolute"
      w="100%"
      h="100%"
      alignItems="center"
      justifyContent="center"
      direction="column"
      {...props}
    />
  );
};

export default Fullbox;
