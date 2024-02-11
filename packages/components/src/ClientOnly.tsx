import React, {FC, useEffect} from 'react';
type Props = {
  children: React.ReactNode | (() => React.ReactNode);
};

const ClientOnly: FC<Props> = (props) => {
  const [isMounted, setIsMounted] = React.useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const {children} = props;
  if (!isMounted) return null;
  return <>{typeof children === 'function' ? children() : children}</>;
};

export default ClientOnly;
