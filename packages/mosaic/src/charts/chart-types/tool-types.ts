import {Tool} from 'ai';
import {PanelResult} from '../../ai/tool-helpers';
import {DashboardToolDeps} from './base-types';

export type ChartToolErrorOutput = {
  llmResult: {
    success: false;
    errorMessage?: string;
  };
};

export type ChartToolSuccessOutput = {
  llmResult: {
    success: true;
    details?: string;
    data?: PanelResult;
  };
};

export type ChartToolOutput = ChartToolSuccessOutput | ChartToolErrorOutput;

export type ChartToolFactory<T> = (
  deps: DashboardToolDeps,
) => Tool<T, ChartToolOutput>;
