/**
 * File parsing utility for AI context.
 *
 * OpenRouter natively supports images and PDFs.
 * For XLS/XLSX, PPT/PPTX, CSV, and text files we extract text on
 * our side and inject it into the user message.
 */

import * as XLSX from 'xlsx';
import { unzipSync } from 'fflate';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParseResult = {
  /** Extracted plain-text content (empty for natively-supported types). */
  extractedText: string;
  /** true when the file can be sent as-is to OpenRouter (images, PDFs). */
  canSendNatively: boolean;
};

const MAX_TEXT_LEN = 50_000;

export async function parseFileToText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ParseResult> {
  // Images → send natively
  if (mimeType.startsWith('image/')) {
    return { extractedText: '', canSendNatively: true };
  }

  // PDF → send natively (OpenRouter has pdf-text / mistral-ocr plugins)
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    return { extractedText: '', canSendNatively: true };
  }

  // CSV → plain text
  if (
    mimeType === 'text/csv' ||
    filename.endsWith('.csv')
  ) {
    return {
      extractedText: buffer.toString('utf-8').slice(0, MAX_TEXT_LEN),
      canSendNatively: false,
    };
  }

  // XLS / XLSX
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    /\.xlsx?$/i.test(filename)
  ) {
    return { extractedText: parseSpreadsheet(buffer), canSendNatively: false };
  }

  // PPT / PPTX
  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    /\.pptx?$/i.test(filename)
  ) {
    return {
      extractedText: extractPptxText(buffer),
      canSendNatively: false,
    };
  }

  // Plain text files (.txt, .md, .json, etc.)
  if (mimeType.startsWith('text/') || /\.(txt|md|json|xml|html|css|js|ts)$/i.test(filename)) {
    return {
      extractedText: buffer.toString('utf-8').slice(0, MAX_TEXT_LEN),
      canSendNatively: false,
    };
  }

  // Unknown binary — best effort
  return { extractedText: '', canSendNatively: false };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSpreadsheet(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
      return `## Sheet: ${name}\n${csv}`;
    });
    return sheets.join('\n\n').slice(0, MAX_TEXT_LEN);
  } catch {
    return '[Error: could not parse spreadsheet]';
  }
}

/**
 * Extract text from a PPTX file.
 * PPTX is a ZIP archive containing XML slide files.
 * We read ppt/slides/slide*.xml and pull out all <a:t> text nodes.
 */
function extractPptxText(buffer: Buffer): string {
  try {
    const files = unzipSync(new Uint8Array(buffer));
    const slideEntries = Object.entries(files)
      .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort(([a], [b]) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10);
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10);
        return numA - numB;
      });

    const texts: string[] = [];
    for (const [name, data] of slideEntries) {
      const xml = new TextDecoder().decode(data);
      // Extract text from <a:t> tags
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
      const slideText = matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .trim();
      if (slideText) {
        const slideNum = name.match(/slide(\d+)/)?.[1] ?? '?';
        texts.push(`## Slide ${slideNum}\n${slideText}`);
      }
    }

    return (texts.join('\n\n') || '[No text found in presentation]').slice(
      0,
      MAX_TEXT_LEN,
    );
  } catch {
    return '[Error: could not parse presentation]';
  }
}
