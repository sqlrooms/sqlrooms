import {cn} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import React from 'react';
import {ChartBuilderActions} from './ChartBuilderActions';
import {useChartBuilderContext} from './ChartBuilderContext';
import {ChartBuilderFields} from './ChartBuilderFields';
import {
  ChartBuilderRoot,
  type ChartBuilderRootProps,
} from './ChartBuilderDialog';
import {ChartBuilderTypeGrid} from './ChartBuilderTypeGrid';
import type {
  ChartBuilderColumn,
  ChartBuilderTemplate,
  ChartTypeDefinition,
} from './types';

type StandaloneChartBuilderContentProps = {
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Preferred shared chart-type customization surface */
  chartTypes?: ChartTypeDefinition[];
  /** Backward-compatible UI template customization surface */
  builders?: ChartBuilderTemplate[];
  /** Custom class name */
  className?: string;
};

export type ChartBuilderContentProps = Partial<
  Omit<ChartBuilderRootProps, 'children'>
> &
  Pick<StandaloneChartBuilderContentProps, 'className'>;

function isStandaloneProps(
  props: ChartBuilderContentProps,
): props is StandaloneChartBuilderContentProps {
  return Boolean(props.tableName && props.columns && props.onCreateChart);
}

function ChartBuilderContentBody({className}: {className?: string}) {
  useChartBuilderContext();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ChartBuilderTypeGrid />
      <ChartBuilderFields />
      <ChartBuilderActions />
    </div>
  );
}

/**
 * Standalone chart builder UI for creating Mosaic charts from templates.
 *
 * Can be used directly with props, or inside `<MosaicChartBuilder>` where it
 * consumes the surrounding builder context.
 */
export const ChartBuilderContent: React.FC<ChartBuilderContentProps> = (
  props,
) => {
  if (isStandaloneProps(props)) {
    const {className, ...rootProps} = props;
    return (
      <ChartBuilderRoot {...rootProps}>
        <ChartBuilderContentBody className={className} />
      </ChartBuilderRoot>
    );
  }

  return <ChartBuilderContentBody className={props.className} />;
};
