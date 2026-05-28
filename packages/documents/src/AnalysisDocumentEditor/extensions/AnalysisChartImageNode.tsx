import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {AnalysisImageNodeView} from '../node-views/AnalysisImageNodeView';

export const AnalysisChartImageNode = Node.create({
  name: 'analysisChartImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      assetId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'figure[data-type="analysis-chart-image"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {'data-type': 'analysis-chart-image'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => (
      <AnalysisImageNodeView {...props} label="Chart image" />
    ));
  },
});
