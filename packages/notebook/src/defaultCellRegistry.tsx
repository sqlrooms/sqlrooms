import React from 'react';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {MarkdownCell} from './cells/MarkdownCell';
import {VegaCell} from './cells/VegaCell';
import {InputCell} from './cells/InputCell';
import {NotebookCell} from './cellSchemas';

export type CellRegistryItem = {
  title: string;
  createCell: (id: string) => NotebookCell;
  renderComponent: (
    id: string,
    getCustom?: (t: string) => ((c: NotebookCell) => any) | undefined,
  ) => any;
  findDependents: (
    changed: NotebookCell,
    cells: Record<string, NotebookCell>,
  ) => string[];
};

export type CellRegistry = Record<string, CellRegistryItem>;

export const defaultCellRegistry: CellRegistry = {
  sql: {
    title: 'SQL',
    createCell: (id) =>
      ({
        id,
        type: 'sql',
        name: `cell_${id.slice(0, 5)}`,
        sql: '',
      }) as NotebookCell,
    renderComponent: (id: string, getCustom) => {
      const cr = getCustom?.('sql');
      return cr
        ? cr({id, type: 'sql', name: '', sql: ''} as any)
        : React.createElement(SqlCell as any, {id});
    },
    findDependents: () => [],
  },
  text: {
    title: 'Text',
    createCell: (id) =>
      ({id, type: 'text', name: 'Text', text: ''}) as NotebookCell,
    renderComponent: (id: string, getCustom) => {
      const cr = getCustom?.('text');
      return cr
        ? cr({id, type: 'text', name: '', text: ''} as any)
        : React.createElement(TextCell as any, {id});
    },
    findDependents: () => [],
  },
  markdown: {
    title: 'Markdown',
    createCell: (id) =>
      ({id, type: 'markdown', name: 'Markdown', markdown: ''}) as NotebookCell,
    renderComponent: (id: string, getCustom) => {
      const cr = getCustom?.('markdown');
      return cr
        ? cr({id, type: 'markdown', name: '', markdown: ''} as any)
        : React.createElement(MarkdownCell as any, {id});
    },
    findDependents: () => [],
  },
  vega: {
    title: 'Vega',
    createCell: (id) =>
      ({id, type: 'vega', name: 'Chart', sql: ''}) as NotebookCell,
    renderComponent: (id: string, getCustom) => {
      const cr = getCustom?.('vega');
      return cr
        ? cr({id, type: 'vega', name: '', sql: ''} as any)
        : React.createElement(VegaCell as any, {id});
    },
    findDependents: () => [],
  },
  input: {
    title: 'Input',
    createCell: (id) =>
      ({
        id,
        type: 'input',
        name: 'Input',
        input: {kind: 'text', varName: 'var', value: ''} as any,
      }) as NotebookCell,
    renderComponent: (id: string, getCustom) => {
      const cr = getCustom?.('input');
      return cr
        ? cr({
            id,
            type: 'input',
            name: '',
            input: {kind: 'text', varName: '', value: ''},
          } as any)
        : React.createElement(InputCell as any, {id});
    },
    findDependents: (changed, cells) => {
      if (changed.type !== 'input') return [];
      const varName = changed.input.varName;
      const dependents: string[] = [];
      for (const key in cells) {
        const c = cells[key];
        if (c?.type === 'sql') {
          const text = (c as any).sql as string;
          if (
            (text && text.indexOf(`{{${varName}}}`) >= 0) ||
            (text && text.indexOf(`:${varName}`) >= 0)
          ) {
            dependents.push(c.id);
          }
        }
      }
      return dependents;
    },
  },
};
