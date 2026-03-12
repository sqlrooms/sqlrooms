import * as arrow from 'apache-arrow';
import {useStoreWithDuckDb} from './DuckDbSlice';

export function useCopyAsTsv() {
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

export function useExportToCsv() {
  const getConnector = useStoreWithDuckDb((state) => state.db.getConnector);
  return {
    exportToCsv: async (query: string, fileName: string, pageSize = 100000) => {
      const dbConnector = await getConnector();

      let offset = 0;
      const blobs: Blob[] = [];
      let headersAdded = false;

      while (true) {
        const currentQuery = `(
          ${query}
        ) LIMIT ${pageSize} OFFSET ${offset}`;
        const results = await dbConnector.query(currentQuery);

        // Check if we received any results; if not, we are done.
        if (results.numRows === 0) {
          break;
        }

        const csvChunk = convertToCsv(results, !headersAdded);
        blobs.push(new Blob([csvChunk], {type: 'text/csv'}));

        // Ensure that headers are not added in subsequent iterations
        headersAdded = true;

        // Increment offset to fetch the next chunk
        offset += pageSize;
      }

      const fullCsvBlob = new Blob(blobs, {type: 'text/csv'});
      downloadBlob(fullCsvBlob, fileName);
    },
  };
}

function convertToCsv(
  arrowTable: arrow.Table,
  includeHeaders: boolean,
): string {
  // return includeHeaders
  //   ? csvFormat(arrowTable.toArray())
  //   : csvFormatBody(arrowTable.toArray());

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
  let csvContent = includeHeaders ? columnNames.join(',') + '\r\n' : '';

  // Add data rows
  for (let i = 0; i < arrowTable.numRows; i++) {
    const csvRow = columnNames
      .map((columnName) => {
        const cellValue = columnsByName[columnName]?.get(i);

        // If the cell value is null or undefined, set it to an empty string.
        if (cellValue == null) return '';

        // Convert cell value to string
        let cellValueStr = String(cellValue);

        // Escape double quotes and wrap cell value in double quotes if necessary
        if (
          cellValueStr.includes('"') ||
          cellValueStr.includes(',') ||
          cellValueStr.includes('\n')
        ) {
          cellValueStr = '"' + cellValueStr.replace(/"/g, '""') + '"';
        }

        return cellValueStr;
      })
      .join(',');

    csvContent += csvRow + '\r\n';
  }

  return csvContent;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
