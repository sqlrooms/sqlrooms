import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {AnalysisChartNodeView} from '../node-views/AnalysisChartNodeView';

export const AnalysisChartNode = Node.create({
  name: 'analysisChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      tableName: {default: null},
      config: {default: {}},
      selectionGroupId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="analysis-chart"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'analysis-chart'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnalysisChartNodeView);
  },
});
