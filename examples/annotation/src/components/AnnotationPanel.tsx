import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {AnnotationList} from '@sqlrooms/annotation';
import {ProjectPanelTypes} from '../store.js';

const AnnotationPanel = () => (
  <ProjectBuilderPanel type={ProjectPanelTypes.enum['annotations']}>
    <AnnotationList className="p-2" />
  </ProjectBuilderPanel>
);

export default AnnotationPanel;
