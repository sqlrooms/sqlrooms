import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {AnnotationList} from '@sqlrooms/annotation';
import {ProjectPanelTypes} from '../store';

/**
 * The AnnotationList component no longer requires getUserName as a prop since
 * components now retrieve this directly from the store.
 */
const AnnotationPanel = () => {
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['annotations']}>
      <AnnotationList className="p-2" />
    </ProjectBuilderPanel>
  );
};

export default AnnotationPanel;
