import {useSql} from '@sqlrooms/duckdb';
import {ErrorPane, SpinnerPane, Textarea} from '@sqlrooms/ui';
import React, {useMemo} from 'react';

type PivotRow = Record<string, unknown>;

type TsvRendererProps = {
  query: string;
};

export const TsvRenderer: React.FC<TsvRendererProps> = ({query}) => {
  const exportResult = useSql<PivotRow>({query, enabled: Boolean(query)});
  const value = useMemo(() => {
    if (!exportResult.data?.arrowTable) {
      return '';
    }
    const headers = exportResult.data.arrowTable.schema.fields.map(
      (field) => field.name,
    );
    const lines = [headers.join('\t')];
    for (const row of exportResult.data) {
      lines.push(headers.map((header) => String(row[header] ?? '')).join('\t'));
    }
    return lines.join('\n');
  }, [exportResult.data]);

  if (exportResult.error) {
    return <ErrorPane error={exportResult.error} />;
  }
  if (exportResult.isLoading) {
    return <SpinnerPane className="h-80" />;
  }

  return (
    <Textarea className="min-h-80 font-mono text-xs" readOnly value={value} />
  );
};
