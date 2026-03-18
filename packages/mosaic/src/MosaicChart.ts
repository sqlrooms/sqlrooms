import {MosaicChartContainer} from './editor/MosaicChartContainer';
import {MosaicChartDisplay} from './editor/MosaicChartDisplay';
import {MosaicSpecEditorPanel} from './editor/MosaicSpecEditorPanel';
import {MosaicChartEditorActions} from './editor/MosaicChartEditorActions';
import {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';

/**
 * Compound component for composable Mosaic chart editing.
 *
 * @example
 * ```tsx
 * <MosaicChart.Container spec={mySpec} onSpecChange={save}>
 *   <MosaicChart.Display />
 *   <MosaicChart.SpecEditor />
 *   <MosaicChart.Actions />
 * </MosaicChart.Container>
 * ```
 */
export const MosaicChart = {
  Container: MosaicChartContainer,
  Display: MosaicChartDisplay,
  SpecEditor: MosaicSpecEditorPanel,
  Actions: MosaicChartEditorActions,
  CodeMirrorEditor: MosaicCodeMirrorEditor,
} as const;
