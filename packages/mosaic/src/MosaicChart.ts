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
 * <MosaicSpecChart.Container spec={mySpec} onSpecChange={save}>
 *   <MosaicSpecChart.Display />
 *   <MosaicSpecChart.SpecEditor />
 *   <MosaicSpecChart.Actions />
 * </MosaicSpecChart.Container>
 * ```
 */
export const MosaicSpecChart = {
  Container: MosaicChartContainer,
  Display: MosaicChartDisplay,
  SpecEditor: MosaicSpecEditorPanel,
  Actions: MosaicChartEditorActions,
  CodeMirrorEditor: MosaicCodeMirrorEditor,
} as const;
