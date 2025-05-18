import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {AnnotationList} from '@sqlrooms/annotation';
import {ProjectPanelTypes} from '../store.js';
import {useProjectStore} from '../store.js';

const AnnotationPanel = () => {
  const getUserName = useProjectStore((s) => s.annotation.getUserName);
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['annotations']}>
      <AnnotationList className="p-2" getUserName={getUserName} />
    </ProjectBuilderPanel>
  );
};

export default AnnotationPanel;
