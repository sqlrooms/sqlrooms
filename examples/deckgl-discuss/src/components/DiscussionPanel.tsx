import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {DiscussionList} from '@sqlrooms/discussion';
import {ProjectPanelTypes} from '../store';

/**
 * The DiscussionList component no longer requires getUserName as a prop since
 * components now retrieve this directly from the store.
 */
const DiscussionPanel = () => {
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['discuss']}>
      <DiscussionList className="p-2" />
    </ProjectBuilderPanel>
  );
};

export default DiscussionPanel;
