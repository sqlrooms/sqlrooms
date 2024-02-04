import {Flex} from '@chakra-ui/react';
import styled from '@emotion/styled';
import {SkeletonPane} from '@sqlrooms/components';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import React, {FC, useEffect} from 'react';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';
type Props = {
  showHeader?: boolean;
  pageUrl?: string;
};

const DOCS_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://docs.flowmap.city';

const Container = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  & > iframe {
    border: none;
    flex: 1;
    width: 100%;
    height: 100%;
  }
  visibility: hidden;
  &.loaded {
    visibility: visible;
  }
`;

const DocumentationPanel: FC<Props> = ({
  pageUrl = '/docs',
  showHeader = true,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isLoaded, setLoaded] = React.useState(false);
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.addEventListener('load', () => {
          setLoaded(true);
        });
      }
    }
  }, []);

  return (
    <Flex flexDir="column" flexGrow={1} gap={3}>
      {showHeader && (
        <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DOCS} />
      )}
      <Flex position="relative" flexGrow="1">
        <Container ref={containerRef} className={isLoaded ? 'loaded' : ''}>
          <iframe src={`${DOCS_URL}${pageUrl}`} />
        </Container>
        {!isLoaded && (
          <Flex position="absolute" top="0" h="100%" w="100%" bg="gray.700">
            <SkeletonPane px="4" n={6} />
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};

export default DocumentationPanel;
