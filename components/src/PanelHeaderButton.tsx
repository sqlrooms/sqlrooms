import {IconButton} from '@chakra-ui/react';
import React, {FC} from 'react';
type Props = {
  label: string;
  icon: React.ReactElement;
  isPinned?: boolean;
  onClick: () => void;
};
const PanelHeaderButton: FC<Props> = (props) => {
  const {isPinned, icon, label: title, onClick} = props;
  return (
    <IconButton
      size="xs"
      onClick={onClick}
      icon={icon}
      color={isPinned ? 'whiteAlpha.800' : 'whiteAlpha.500'}
      _hover={{color: 'white', bg: 'whiteAlpha.300'}}
      variant="ghost"
      aria-label={title}
    />
  );
};

export default PanelHeaderButton;
