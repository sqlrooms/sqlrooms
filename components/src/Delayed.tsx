import React, {ReactNode, useEffect, useState} from 'react';

interface DelayedProps {
  delay: number;
  children: ReactNode;
}

/**
 * Wait for a delay before rendering children
 */
const Delayed: React.FC<DelayedProps> = ({delay, children}) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer); // clear the timeout if the component unmounts
  }, [delay]);

  return shouldRender ? <>{children}</> : null;
};

export default Delayed;
