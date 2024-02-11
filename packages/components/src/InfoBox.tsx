import {QuestionOutlineIcon} from '@chakra-ui/icons';
import {HStack, Tooltip} from '@chakra-ui/react';
import {FC, ReactNode} from 'react';

const InfoBox: FC<{content: ReactNode; children: ReactNode}> = ({
  content,
  children,
}) => {
  return (
    <Tooltip p={3} label={content} hasArrow placement="left">
      <HStack _hover={{color: 'white'}} transition="color 0.2s ease" gap="2">
        <QuestionOutlineIcon w="15px" h="15px" />
        {children}
      </HStack>
    </Tooltip>

    // <Popover placement="top-start" trigger={'hover'}>
    //   <PopoverTrigger>
    //     <Button size="0px" width="32px" height="32px" variant="ghost">
    //       <QuestionMarkCircleIcon />
    //     </Button>
    //   </PopoverTrigger>
    //   <Portal>
    //     <PopoverContent maxWidth={250} bg={'gray.600'}>
    //       <PopoverArrow bg={'gray.600'} />
    //       {/*<PopoverCloseButton />*/}
    //       {/*<PopoverHeader fontSize="sm" fontWeight="bold">*/}
    //       {/*  {title}*/}
    //       {/*</PopoverHeader>*/}
    //       <PopoverBody>
    //         <Box fontSize="sm">{children}</Box>
    //       </PopoverBody>
    //     </PopoverContent>
    //   </Portal>
    // </Popover>
  );
};

export default InfoBox;
