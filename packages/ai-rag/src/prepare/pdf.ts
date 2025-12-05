/**
 * PDF text extraction using pdf.js.
 * Mirrors PDF handling capability from Python module.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - uses the same version as the library
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract text content from a PDF file.
 * @param file - PDF file to extract text from
 * @returns Extracted text content
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

/**
 * Extract text from a PDF ArrayBuffer.
 * @param data - PDF data as ArrayBuffer
 * @returns Extracted text content
 */
export async function extractTextFromPDFBuffer(
  data: ArrayBuffer,
): Promise<string> {
  const pdf = await pdfjsLib.getDocument({data}).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

/**
 * Check if a file is a PDF.
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}
