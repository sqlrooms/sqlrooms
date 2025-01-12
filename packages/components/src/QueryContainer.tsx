import {Progress} from '@chakra-ui/react';
import {QueryErrorResetBoundary} from '@tanstack/react-query';
import React, {Suspense, useContext} from 'react';
import SkeletonPane from './SkeletonPane';
import SpinnerPane from './SpinnerPane';
import {AppContext} from './AppContext';
import ClientOnly from './ClientOnly';
// import {TRPCClientError} from '@trpc/client';

type Props = {
  loading?: 'spinner' | 'skeleton' | 'progress' | React.ReactNode;
  embedded?: boolean;
  children: React.ReactNode;
};

const QueryContainer: React.FC<Props> = ({loading = 'skeleton', children}) => {
  const {ErrorBoundary} = useContext(AppContext);
  return (
    <ClientOnly>
      <QueryErrorResetBoundary>
        {({reset}) => (
          <ErrorBoundary onReset={reset}>
            <Suspense
              fallback={
                loading === 'spinner' ? (
                  <SpinnerPane />
                ) : loading === 'progress' ? (
                  <Progress isIndeterminate width="100%" />
                ) : loading === 'skeleton' ? (
                  <SkeletonPane n={3} p={5} height="100%" />
                ) : (
                  loading
                )
              }
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </ClientOnly>
  );
};

export default QueryContainer;
