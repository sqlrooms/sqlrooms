import {DataTable} from '@flowmapcity/duckdb';
import {ColumnMapping} from '@flowmapcity/project-config';
import {ColumnSpec} from '../types';

export default function autoSelectColumns(
  dataTable: DataTable,
  colSpecs: ColumnSpec[],
  columnMapping: ColumnMapping,
): any {
  const {columns} = columnMapping;
  const {columns: inputTableFields} = dataTable ?? {};
  if (!inputTableFields) {
    return {};
  }
  const nextSelectedColumns = {...columns};
  for (const cs of colSpecs) {
    if (!nextSelectedColumns[cs.name]) {
      let fieldName = inputTableFields.find(
        (c) => c.name.toLowerCase() === cs.name,
      )?.name;
      if (!fieldName) {
        let variants = [cs.name];
        if (cs.nameVariants) {
          variants = [...variants, ...cs.nameVariants];
        }
        fieldName = inputTableFields.find(
          (c) =>
            cs.nameVariants?.some(
              (v: string) => c.name.toLowerCase().indexOf(v) >= 0,
            ),
        )?.name;
      }
      if (fieldName) nextSelectedColumns[cs.name] = fieldName;
    }
  }
  return {
    ...columnMapping,
    columns: nextSelectedColumns,
  };
}
