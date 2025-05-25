import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {DiscussionList} from '@sqlrooms/discuss';
import {ProjectPanelTypes, useProjectStore} from '../store';
import {useEffect} from 'react';

/**
 * The DiscussionPanel component displays a list of discussions
 * with highlighting functionality.
 */
const DiscussionPanel = () => {
  const discussions = useProjectStore((state) => state.discussion.discussions);
  const highlightedDiscussionId = useProjectStore(
    (state) => state.discussion.highlightedDiscussionId,
  );

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['discuss']}>
      {discussions.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <p>No comments yet. Click on an airport to add one.</p>
        </div>
      ) : null}
      <div className="p-2">
        <DiscussionList
          className="flex flex-col gap-4"
          renderUser={() => 'Anonymous user'}
          highlightedDiscussionId={highlightedDiscussionId}
        />
      </div>
    </ProjectBuilderPanel>
  );
};

export default DiscussionPanel;
