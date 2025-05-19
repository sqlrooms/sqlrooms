import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {DiscussionList} from '@sqlrooms/discussion';
import {ProjectPanelTypes, useProjectStore} from '../store';

/**
 * The DiscussionList component no longer requires getUserName as a prop since
 * components now retrieve this directly from the store.
 */
const DiscussionPanel = () => {
  const discussions = useProjectStore((state) => state.discussion.discussions);
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['discuss']}>
      {discussions.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <p>No comments yet. Click on an airport to add one.</p>
        </div>
      ) : (
        <DiscussionList
          className="p-2"
          renderUser={() => {
            return 'Anonymous user';
          }}
        />
      )}
    </ProjectBuilderPanel>
  );
};

export default DiscussionPanel;
