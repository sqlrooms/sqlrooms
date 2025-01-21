import {ProjectPanelTypes} from '@sqlrooms/project-config';
import {SkeletonPane, cn} from '@sqlrooms/ui';
import React, {FC, useEffect} from 'react';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';

export type DocumentationPanelProps = {
  showHeader?: boolean;
  pageUrl?: string;
};

const DocumentationPanel: FC<DocumentationPanelProps> = ({
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
    <div className="flex flex-col flex-grow gap-3">
      {showHeader && (
        <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DOCS} />
      )}
      <div className="relative flex-grow">
        <div
          ref={containerRef}
          className={cn('flex w-full h-full invisible', isLoaded && 'visible')}
        >
          <iframe src={pageUrl} className="flex-1 w-full h-full border-none" />
        </div>
        {!isLoaded && (
          <div className="absolute top-0 w-full h-full bg-gray-700">
            <SkeletonPane className="px-4" n={6} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentationPanel;
