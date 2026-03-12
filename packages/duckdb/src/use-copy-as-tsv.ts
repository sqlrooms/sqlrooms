import * as arrow from 'apache-arrow';
import {useStoreWithDuckDb} from './DuckDbSlice';

export interface UseCopyAsTsvReturn {
  copyAsTsv: (query: string, pageSize?: number) => Promise<number>;
}

export function useCopyAsTsv(): UseCopyAsTsvReturn {
  const getConnector = useStoreWithDuckDb((state) => state.db.getConnector);
  return {
    copyAsTsv: async (query: string, pageSize = 100000): Promise<number> => {
      const dbConnector = await getConnector();

      let offset = 0;
      const chunks: string[] = [];
      let headersAdded = false;
      let totalRows = 0;

      while (true) {
        const currentQuery = `(
          ${query}
        ) LIMIT ${pageSize} OFFSET ${offset}`;
        const results = await dbConnector.query(currentQuery);

        if (results.numRows === 0) {
          break;
        }

        const tsvChunk = convertToTsv(results, !headersAdded);
        chunks.push(tsvChunk);
        totalRows += results.numRows;
        headersAdded = true;
        offset += pageSize;
      }

      await navigator.clipboard.writeText(chunks.join(''));
      return totalRows;
    },
  };
}

function convertToTsv(
  arrowTable: arrow.Table,
  includeHeaders: boolean,
): string {
  const columnNames = arrowTable.schema.fields.map((field) => field.name);
  const columnsByName = columnNames.reduce(
    (acc, columnName) => {
      const col = arrowTable.getChild(columnName);
      if (col) acc[columnName] = col;
      return acc;
    },
    {} as Record<string, arrow.Vector>,
  );

  // Add header
  let tsvContent = includeHeaders ? columnNames.join('\t') + '\r\n' : '';

  // Add data rows
  for (let i = 0; i < arrowTable.numRows; i++) {
    const tsvRow = columnNames
      .map((columnName) => {
        const cellValue = columnsByName[columnName]?.get(i);

        // If the cell value is null or undefined, set it to an empty string.
        if (cellValue == null) return '';

        // Replace tabs and newlines to keep TSV structure intact.
        // TSV has no standard escaping for tabs/newlines (unlike CSV with quoted
        // fields), so we replace them with spaces for spreadsheet compatibility.
        return String(cellValue).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      })
      .join('\t');

    tsvContent += tsvRow + '\r\n';
  }

  return tsvContent;
}
