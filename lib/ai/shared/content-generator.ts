/**
 * Shared content generation functions called by the main AI's edit tools.
 * Each function calls Gemini to generate high-quality content for a specific
 * document type, then returns the structured content ready for storage.
 *
 * These are used when the main AI creates a document and needs to fill it
 * with rich content — the model alone often can't produce complex Slate nodes
 * or Konva shapes in a single tool call parameter.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import {
  PLATE_NODE_FORMAT_GUIDE,
  KONVA_SHAPE_FORMAT_GUIDE,
  UNIVER_CELL_FORMAT_GUIDE,
  CONTENT_QUALITY_GUIDELINES,
} from './generation-prompts';

function getGoogle() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
  return createGoogleGenerativeAI({ apiKey });
}

function tryParseJson(text: string): unknown | null {
  let stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (!stripped.startsWith('{') && !stripped.startsWith('[')) {
    const jsonStart = stripped.search(/[\[{]/);
    if (jsonStart >= 0) stripped = stripped.slice(jsonStart);
  }
  try {
    return JSON.parse(stripped);
  } catch {
    // Try closing open braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escape = false;
    for (const ch of stripped) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceCount++;
      else if (ch === '}') braceCount--;
      else if (ch === '[') bracketCount++;
      else if (ch === ']') bracketCount--;
    }
    let result = stripped;
    if (inString) result += '"';
    while (bracketCount > 0) { result += ']'; bracketCount--; }
    while (braceCount > 0) { result += '}'; braceCount--; }
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
}

// ── Plate content generation ─────────────────────────────────────────────────

export type PlateGenerationResult = {
  success: true;
  nodes: Array<Record<string, unknown>>;
} | {
  success: false;
  error: string;
};

/**
 * Generate rich Plate/Slate content for a document based on a natural language prompt.
 * Returns an array of Slate block nodes ready for storage.
 */
export async function generatePlateContent(
  prompt: string,
  context?: { documentTitle?: string; existingContent?: unknown }
): Promise<PlateGenerationResult> {
  let google;
  try {
    google = getGoogle();
  } catch (err) {
    console.error('[generatePlateContent] Failed to create Google AI client:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Missing API key' };
  }

  const systemPrompt = `You are a professional document content generator for Docsiv.
Your task: generate rich, well-structured document content as a JSON array of Plate/Slate block nodes.

${PLATE_NODE_FORMAT_GUIDE}

${CONTENT_QUALITY_GUIDELINES}

IMPORTANT:
- Return ONLY a JSON array of block nodes. No wrapper object, no markdown fences.
- Generate complete, professional content — never stubs or placeholders.
- Use a variety of block types: headings, paragraphs, lists, tables, blockquotes, etc.
- Minimum 8-15 blocks for a typical document section.`;

  const userMessage = context?.existingContent
    ? `${context.documentTitle ? `Document: "${context.documentTitle}"\n` : ''}Existing content (JSON): ${JSON.stringify(context.existingContent).slice(0, 20000)}\n\nUser request: ${prompt}\n\nReturn the updated content as a JSON array of Plate nodes.`
    : `${context?.documentTitle ? `Document: "${context.documentTitle}"\n` : ''}User request: ${prompt}\n\nGenerate the content as a JSON array of Plate nodes.`;

  try {
    const result = await generateText({
      model: google(DEFAULT_AI_MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 16384,
      temperature: 0.3,
    });

    const rawText = result.text ?? '';
    console.log('[generatePlateContent] Response length:', rawText.length, 'chars');
    const parsed = tryParseJson(rawText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error('[generatePlateContent] Failed to parse response:', rawText.slice(0, 500));
      return { success: false, error: 'Generator returned invalid content format' };
    }

    return { success: true, nodes: parsed as Array<Record<string, unknown>> };
  } catch (err) {
    console.error('[generatePlateContent] Error during generation:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Content generation failed',
    };
  }
}

// ── Konva shape generation ──────────────────────────────────────────────────

/** A single page/slide with its shapes and optional background */
export type KonvaGeneratedPage = {
  shapes: Array<Record<string, unknown>>;
  background?: Record<string, unknown>;
};

export type KonvaGenerationResult = {
  success: true;
  /** Array of pages/slides, each with its own shapes array */
  pages: KonvaGeneratedPage[];
} | {
  success: false;
  error: string;
};

/**
 * Generate Konva content for a report or presentation.
 * Returns an array of pages/slides, each with shapes.
 * For presentations, generates multiple slides. For reports, generates multiple pages.
 */
export async function generateKonvaShapes(
  prompt: string,
  context?: {
    mode?: 'report' | 'presentation';
    pageWidth?: number;
    pageHeight?: number;
    layoutData?: Record<string, unknown>;
  }
): Promise<KonvaGenerationResult> {
  let google;
  try {
    google = getGoogle();
  } catch (err) {
    console.error('[generateKonvaShapes] Failed to create Google AI client:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Missing API key' };
  }
  const mode = context?.mode ?? 'report';
  const pageW = context?.pageWidth ?? (mode === 'presentation' ? 960 : 794);
  const pageH = context?.pageHeight ?? (mode === 'presentation' ? 540 : 1123);
  const unit = mode === 'report' ? 'page' : 'slide';

  const systemPrompt = `You are a professional visual document designer for Docsiv.
Your task: generate a multi-${unit} ${mode} with Konva shape objects. Each ${unit} is ${pageW}×${pageH}px.

${KONVA_SHAPE_FORMAT_GUIDE}

${CONTENT_QUALITY_GUIDELINES}

CRITICAL OUTPUT FORMAT:
Return a JSON array of ${unit} objects. Each ${unit} has a "shapes" array and optional "background":

[
  {
    "shapes": [
      { "className": "Rect", "attrs": { "id": "bg-1", "x": 0, "y": 0, "width": ${pageW}, "height": ${pageH}, "fill": "#1e3a5f" } },
      { "className": "Text", "attrs": { "id": "title-1", "x": 60, "y": 200, "text": "Title", "fontSize": 44, "fontFamily": "Inter", "fontStyle": "bold", "fill": "#ffffff", "width": ${pageW - 120} } }
    ],
    "background": { "type": "solid", "color": "#f5f5f5" }
  },
  {
    "shapes": [ ... more shapes for ${unit} 2 ... ]
  }
]

Shape format — each shape in a ${unit}'s "shapes" array:
{ "className": "Text"|"Rect"|"Circle"|"Ellipse"|"Line"|"Arrow"|"Star"|"RegularPolygon"|"Image"|"Icon"|"Video",
  "attrs": { "id": "unique-id", ...shape-specific properties } }

IMPORTANT:
- Return ONLY the JSON array of ${unit} objects. No wrapper object, no markdown fences.
- For presentations, create 4-8 slides with full content on each.
- For reports, create 1-3 pages with full content on each.
- Design professional, visually polished layouts.
- Use consistent margins, typography hierarchy, and color palette.
- Never overlap text elements.
- Include background shapes, section dividers, and decorative elements for visual appeal.
- Use the user's specific details (names, numbers, scope) — do not output generic placeholders.`;

  const layoutContext = context?.layoutData
    ? `\nLayout analysis data to match: ${JSON.stringify(context.layoutData).slice(0, 10000)}\nReproduce this layout as closely as possible using the shape format above.`
    : '';

  const userMessage = `${unit.charAt(0).toUpperCase() + unit.slice(1)} size: ${pageW}×${pageH}px, Mode: ${mode}${layoutContext}\n\nUser request: ${prompt}\n\nGenerate the full ${mode} as a JSON array of ${unit} objects.`;

  try {
    const result = await generateText({
      model: google(DEFAULT_AI_MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 32768,
      temperature: 0.3,
    });

    const rawText = result.text ?? '';
    console.log('[generateKonvaShapes] Response length:', rawText.length, 'chars');
    const parsed = tryParseJson(rawText);

    // Handle array of page objects: [{ shapes: [...] }, ...]
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Check if it's an array of page objects (each has shapes[])
      const firstItem = parsed[0] as Record<string, unknown>;
      if (firstItem && Array.isArray(firstItem.shapes)) {
        const pages: KonvaGeneratedPage[] = parsed.map((p: Record<string, unknown>) => ({
          shapes: Array.isArray(p.shapes) ? p.shapes as Array<Record<string, unknown>> : [],
          background: p.background as Record<string, unknown> | undefined,
        }));
        return { success: true, pages };
      }
      // Fallback: flat array of shapes (single page)
      return { success: true, pages: [{ shapes: parsed as Array<Record<string, unknown>> }] };
    }

    return { success: false, error: 'Generator returned invalid shape format' };
  } catch (err) {
    console.error('[generateKonvaShapes] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Shape generation failed',
    };
  }
}

// ── Univer cell generation ──────────────────────────────────────────────────

export type UniverGenerationResult = {
  success: true;
  cellData: Record<string, Record<string, Record<string, unknown>>>;
  rowCount: number;
  columnCount: number;
} | {
  success: false;
  error: string;
};

/**
 * Generate Univer spreadsheet cell data based on a prompt.
 */
export async function generateUniverCells(
  prompt: string,
  context?: { documentTitle?: string; existingCells?: unknown }
): Promise<UniverGenerationResult> {
  let google;
  try {
    google = getGoogle();
  } catch (err) {
    console.error('[generateUniverCells] Failed to create Google AI client:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Missing API key' };
  }

  const systemPrompt = `You are a professional spreadsheet content generator for Docsiv.
Your task: generate spreadsheet cell data as a JSON object in Univer format.

${UNIVER_CELL_FORMAT_GUIDE}

${CONTENT_QUALITY_GUIDELINES}

IMPORTANT:
- Return ONLY a JSON object with this structure: { "cellData": {...}, "rowCount": number, "columnCount": number }
- No markdown fences, no extra text.
- Include header rows with bold styling and background color.
- Use appropriate number types and formulas where relevant.
- Generate realistic, complete data — not stubs.`;

  const userMessage = context?.existingCells
    ? `${context.documentTitle ? `Sheet: "${context.documentTitle}"\n` : ''}Existing data: ${JSON.stringify(context.existingCells).slice(0, 20000)}\n\nUser request: ${prompt}\n\nReturn updated cell data.`
    : `${context?.documentTitle ? `Sheet: "${context.documentTitle}"\n` : ''}User request: ${prompt}\n\nGenerate the spreadsheet data.`;

  try {
    console.log('[generateUniverCells] Calling Gemini with prompt:', prompt.slice(0, 200));
    const result = await generateText({
      model: google(DEFAULT_AI_MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 16384,
      temperature: 0.3,
    });

    const rawText = result.text ?? '';
    console.log('[generateUniverCells] Response length:', rawText.length, 'chars');

    const parsed = tryParseJson(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[generateUniverCells] Failed to parse response:', rawText.slice(0, 500));
      return { success: false, error: 'Generator returned invalid cell format' };
    }

    const obj = parsed as Record<string, unknown>;
    const cellData = (obj.cellData ?? obj) as Record<string, Record<string, Record<string, unknown>>>;

    // Compute row/column counts from the data
    const rowKeys = Object.keys(cellData).map(Number).filter((n) => !isNaN(n));
    const maxRow = rowKeys.length > 0 ? Math.max(...rowKeys) + 1 : 0;
    let maxCol = 0;
    for (const row of Object.values(cellData)) {
      if (typeof row === 'object' && row) {
        const colKeys = Object.keys(row).map(Number).filter((n) => !isNaN(n));
        if (colKeys.length > 0) maxCol = Math.max(maxCol, ...colKeys);
      }
    }

    // Use generous defaults matching Univer's default grid (manual creation leaves
    // these undefined so Univer shows ~1000 rows / 26 cols). We use at least 200 rows
    // and 26 columns so AI-created sheets look the same as manually created ones.
    console.log('[generateUniverCells] Success: rows=', maxRow, 'cols=', maxCol + 1);
    return {
      success: true,
      cellData,
      rowCount: Math.max(maxRow + 1, 200),
      columnCount: Math.max(maxCol + 1, 26),
    };
  } catch (err) {
    console.error('[generateUniverCells] Error during generation:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Cell generation failed',
    };
  }
}
