import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {AnnotationList} from '@sqlrooms/annotation';
import {ProjectPanelTypes} from '../store';
import {useProjectStore} from '../store';

/**
 * TODO: This example needs to be updated to match the refactored AnnotationList component.
 *
 * The AnnotationList component no longer requires getUserName as a prop since
 * components now retrieve this directly from the store. The ts-ignore is a
 * temporary fix until the example is properly updated.
 */
const AnnotationPanel = () => {
  // Keep the getUserName reference to make TypeScript happy
  // This is a temporary fix until we update the example project
  const getUserName = useProjectStore((s) => s.annotation.getUserName);

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['annotations']}>
      <AnnotationList
        className="p-2"
        // @ts-ignore - getUserName is no longer needed in the refactored component
        getUserName={getUserName}
      />
    </ProjectBuilderPanel>
  );
};

export default AnnotationPanel;
