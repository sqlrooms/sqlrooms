import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {AnnotationList} from '@sqlrooms/annotation';
import {ProjectPanelTypes} from '../store.js';

const AnnotationPanel = () => (
  <ProjectBuilderPanel type={ProjectPanelTypes.enum['annotations']}>
    <AnnotationList />
  </ProjectBuilderPanel>
);

export default AnnotationPanel;
