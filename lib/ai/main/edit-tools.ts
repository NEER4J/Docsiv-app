import { tool } from "ai";
import { z } from "zod";
import {
  getDocumentById,
  updateDocumentContent,
  updateDocumentRecord,
  checkDocumentAccess,
} from "@/lib/actions/documents";
import type { Value } from "platejs";

// ── Edit Document Plate Tool ────────────────────────────────────────────────

export function createEditDocumentPlateTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Edit a Plate (rich text) document directly. Use for adding, updating, or modifying content in text documents. Supports append, prepend, insert_at, replace, and update_selection operations. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["append", "prepend", "insert_at", "replace", "update_selection"])
        .describe("How to apply the edit"),
      content: z
        .array(z.record(z.any()))
        .describe(
          "Array of Slate nodes to insert. Example: [{ type: 'h2', children: [{ text: 'Heading' }] }]"
        ),
      position: z
        .number()
        .optional()
        .describe("Node index for insert_at operation (0 = beginning)"),
      selection_block_ids: z
        .array(z.string())
        .optional()
        .describe("Block IDs to replace when using update_selection"),
      reason: z
        .string()
        .optional()
        .describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({
      document_id,
      operation,
      content,
      position,
      selection_block_ids,
      reason,
    }) => {
      // Check access permissions
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You do not have edit permission for this document",
        };
      }

      // Get current document
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
      if (docError || !document) {
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a plate-compatible document
      const isPlateDoc = ["doc", "contract"].includes(document.base_type);
      if (!isPlateDoc) {
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Plate editor. Use the appropriate editor tool.`,
        };
      }

      // Get current content
      const currentContent = (document.content ?? {
        editor: "plate",
        pages: [{ nodes: [] }],
      }) as { editor: string; pages: Array<{ nodes: Value }> };

      if (!currentContent.pages || currentContent.pages.length === 0) {
        currentContent.pages = [{ nodes: [] }];
      }

      const fullValue = currentContent.pages[0].nodes;
      let newValue: Value;

      // Apply the edit operation
      switch (operation) {
        case "append":
          newValue = [...fullValue, ...(content as Value)];
          break;
        case "prepend":
          newValue = [...(content as Value), ...fullValue];
          break;
        case "insert_at": {
          const idx = Math.max(
            0,
            Math.min(position ?? fullValue.length, fullValue.length)
          );
          newValue = [...fullValue.slice(0, idx), ...(content as Value), ...fullValue.slice(idx)];
          break;
        }
        case "replace":
          newValue = content as Value;
          break;
        case "update_selection":
          if (!selection_block_ids || selection_block_ids.length === 0) {
            return {
              success: false as const,
              error: "selection_block_ids required for update_selection operation",
            };
          }
          // Replace blocks with matching IDs
          newValue = fullValue.map((node: Record<string, unknown>) => {
            const nodeId = node.id as string | undefined;
            if (nodeId && selection_block_ids.includes(nodeId)) {
              // Replace with first new content, or keep if no content left
              const replacement = (content as Value).shift();
              return replacement ?? node;
            }
            return node;
          });
          // Append any remaining new content
          newValue = [...newValue, ...(content as Value)];
          break;
        default:
          newValue = fullValue;
      }

      // Update the document
      const newContent = {
        ...currentContent,
        pages: [{ nodes: newValue }],
      };

      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

      return {
        success: true as const,
        document_id,
        title: document.title,
        operation,
        nodes_affected: (content as Value).length,
        reason: reason ?? `Applied ${operation} operation`,
      };
    },
  });
}

// ── Edit Document Konva Tool ────────────────────────────────────────────────

interface KonvaShape {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  text?: string;
  fontSize?: number;
  [key: string]: unknown;
}

interface KonvaPage {
  id: string;
  shapes: KonvaShape[];
}

interface KonvaReportContent {
  editor: "konva";
  report?: {
    pages: KonvaPage[];
    pageWidthPx?: number;
    pageHeightPx?: number;
  };
  presentation?: {
    slides: KonvaPage[];
  };
}

export function createEditDocumentKonvaTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Edit a Konva (visual) document directly. Use for adding, updating, or modifying pages, shapes, and layout in reports and presentations. Supports add_page, update_page, delete_page, update_shapes, and apply_layout operations. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["add_page", "update_page", "delete_page", "update_shapes", "apply_layout"])
        .describe("How to modify the document"),
      page_index: z
        .number()
        .optional()
        .describe("Page/slide index for page-specific operations (0-based)"),
      layout_data: z
        .object({
          sections: z.array(z.record(z.any())).optional(),
          color_scheme: z.record(z.string()).optional(),
        })
        .optional()
        .describe("Layout analysis data to apply (from analyze_layout_image)"),
      shapes: z
        .array(z.record(z.any()))
        .optional()
        .describe("Array of shape objects to add or update"),
      reason: z
        .string()
        .optional()
        .describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, operation, page_index, layout_data, shapes, reason }) => {
      // Check access permissions
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You do not have edit permission for this document",
        };
      }

      // Get current document
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
      if (docError || !document) {
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a Konva document
      const isKonvaDoc = ["report", "presentation"].includes(
        document.document_type?.slug ?? ""
      ) || ["presentation"].includes(document.base_type);

      if (!isKonvaDoc) {
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Konva editor. Use the appropriate editor tool.`,
        };
      }

      // Get current content
      const currentContent = (document.content ?? {
        editor: "konva",
        report: { pages: [] },
      }) as KonvaReportContent;

      const pages = currentContent.report?.pages ?? currentContent.presentation?.slides ?? [];

      // Apply the edit operation
      let updatedPages = [...pages];

      switch (operation) {
        case "add_page": {
          const newPage: KonvaPage = {
            id: `page-${Date.now()}`,
            shapes: shapes ?? [],
          };
          const insertIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(insertIdx, 0, newPage);
          break;
        }
        case "update_page": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          updatedPages[page_index] = {
            ...updatedPages[page_index],
            shapes: shapes ?? updatedPages[page_index].shapes,
          };
          break;
        }
        case "delete_page": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          updatedPages.splice(page_index, 1);
          break;
        }
        case "update_shapes": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          // Merge or replace shapes
          const currentShapes = updatedPages[page_index].shapes;
          const newShapes = shapes ?? [];
          // Replace shapes with matching IDs, append new ones
          const shapeMap = new Map(currentShapes.map((s) => [s.id, s]));
          for (const shape of newShapes) {
            if (shape.id && shapeMap.has(shape.id)) {
              shapeMap.set(shape.id, { ...shapeMap.get(shape.id), ...shape });
            } else {
              shapeMap.set(shape.id ?? `shape-${Date.now()}-${Math.random()}`, shape);
            }
          }
          updatedPages[page_index].shapes = Array.from(shapeMap.values());
          break;
        }
        case "apply_layout": {
          if (!layout_data) {
            return {
              success: false as const,
              error: "layout_data required for apply_layout operation",
            };
          }
          // Create a new page based on layout sections
          const layoutShapes: KonvaShape[] = [];
          let yOffset = 20;

          for (const section of layout_data.sections ?? []) {
            // Add section header
            layoutShapes.push({
              id: `section-${section.type}-${Date.now()}`,
              type: "text",
              x: 20,
              y: yOffset,
              width: 400,
              height: 30,
              text: section.content ?? section.type.toUpperCase(),
              fontSize: 18,
              fill: layout_data.color_scheme?.primary ?? "#000000",
            });
            yOffset += 40;

            // Add placeholder for content
            if (section.type === "content") {
              layoutShapes.push({
                id: `content-${Date.now()}-${Math.random()}`,
                type: "rect",
                x: 20,
                y: yOffset,
                width: 500,
                height: 200,
                fill: layout_data.color_scheme?.background ?? "#f5f5f5",
                stroke: layout_data.color_scheme?.secondary ?? "#cccccc",
              });
              yOffset += 220;
            }
          }

          const layoutPage: KonvaPage = {
            id: `layout-page-${Date.now()}`,
            shapes: layoutShapes,
          };

          const insertIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(insertIdx, 0, layoutPage);
          break;
        }
        default:
          return {
            success: false as const,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Build updated content
      const isPresentation = !!currentContent.presentation;
      const newContent = isPresentation
        ? {
            ...currentContent,
            presentation: {
              ...currentContent.presentation,
              slides: updatedPages,
            },
          }
        : {
            ...currentContent,
            report: {
              ...currentContent.report,
              pages: updatedPages,
            },
          };

      // Update the document
      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

      return {
        success: true as const,
        document_id,
        title: document.title,
        operation,
        page_index,
        pages_count: updatedPages.length,
        reason: reason ?? `Applied ${operation} operation`,
      };
    },
  });
}

// ── Edit Document Univer Tool ────────────────────────────────────────────────

interface UniverCell {
  v?: string | number | boolean;
  s?: Record<string, unknown>; // style
  f?: string; // formula
}

interface UniverSheet {
  id: string;
  name: string;
  cellData: Record<string, Record<string, UniverCell>>;
  rowCount?: number;
  columnCount?: number;
}

interface UniverContent {
  editor: "univer-sheets";
  snapshot: {
    sheets: Record<string, UniverSheet>;
  };
}

export function createEditDocumentUniverTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Edit an Univer (spreadsheet) document directly. Use for updating cells, adding sheets, and applying formulas. Supports update_cells, add_sheet, apply_formula, and update_range operations. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["update_cells", "add_sheet", "apply_formula", "update_range"])
        .describe("How to modify the spreadsheet"),
      sheet_id: z.string().optional().describe("Sheet ID for sheet-specific operations"),
      cell_updates: z
        .record(z.record(z.any()))
        .optional()
        .describe(
          'Cell updates as { row: { col: { v: value, s?: style, f?: formula } } }. Example: { "0": { "0": { "v": "Header" } } }'
        ),
      range: z
        .object({
          startRow: z.number(),
          endRow: z.number(),
          startCol: z.number(),
          endCol: z.number(),
        })
        .optional()
        .describe("Cell range for range-based operations"),
      formula: z
        .string()
        .optional()
        .describe("Formula to apply (for apply_formula operation)"),
      reason: z.string().optional().describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, operation, sheet_id, cell_updates, range, formula, reason }) => {
      // Check access permissions
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You do not have edit permission for this document",
        };
      }

      // Get current document
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
      if (docError || !document) {
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a spreadsheet document
      const isSheetDoc = document.base_type === "sheet";
      if (!isSheetDoc) {
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Univer editor. Use the appropriate editor tool.`,
        };
      }

      // Get current content
      const currentContent = (document.content ?? {
        editor: "univer-sheets",
        snapshot: { sheets: {} },
      }) as UniverContent;

      const sheets = currentContent.snapshot?.sheets ?? {};

      // Get or create target sheet
      let targetSheetId = sheet_id;
      if (!targetSheetId || !sheets[targetSheetId]) {
        const firstSheetId = Object.keys(sheets)[0];
        if (firstSheetId) {
          targetSheetId = firstSheetId;
        } else {
          // Create default sheet
          targetSheetId = "sheet-1";
          sheets[targetSheetId] = {
            id: targetSheetId,
            name: "Sheet 1",
            cellData: {},
            rowCount: 100,
            columnCount: 20,
          };
        }
      }

      const targetSheet = sheets[targetSheetId];

      // Apply the edit operation
      switch (operation) {
        case "update_cells": {
          if (!cell_updates) {
            return {
              success: false as const,
              error: "cell_updates required for update_cells operation",
            };
          }
          // Merge cell updates
          for (const [row, cols] of Object.entries(cell_updates)) {
            if (!targetSheet.cellData[row]) {
              targetSheet.cellData[row] = {};
            }
            for (const [col, cell] of Object.entries(cols as Record<string, UniverCell>)) {
              targetSheet.cellData[row][col] = {
                ...targetSheet.cellData[row][col],
                ...cell,
              };
            }
          }
          break;
        }
        case "add_sheet": {
          const newSheetId = `sheet-${Object.keys(sheets).length + 1}-${Date.now()}`;
          sheets[newSheetId] = {
            id: newSheetId,
            name: `Sheet ${Object.keys(sheets).length + 1}`,
            cellData: {},
            rowCount: 100,
            columnCount: 20,
          };
          break;
        }
        case "apply_formula": {
          if (!formula || !range) {
            return {
              success: false as const,
              error: "formula and range required for apply_formula operation",
            };
          }
          // Apply formula to range
          for (let r = range.startRow; r <= range.endRow; r++) {
            for (let c = range.startCol; c <= range.endCol; c++) {
              const rowKey = String(r);
              const colKey = String(c);
              if (!targetSheet.cellData[rowKey]) {
                targetSheet.cellData[rowKey] = {};
              }
              targetSheet.cellData[rowKey][colKey] = {
                ...targetSheet.cellData[rowKey][colKey],
                f: formula,
              };
            }
          }
          break;
        }
        case "update_range": {
          if (!cell_updates || !range) {
            return {
              success: false as const,
              error: "cell_updates and range required for update_range operation",
            };
          }
          // Apply updates within range
          for (let r = range.startRow; r <= range.endRow; r++) {
            const rowKey = String(r);
            if (cell_updates[rowKey]) {
              if (!targetSheet.cellData[rowKey]) {
                targetSheet.cellData[rowKey] = {};
              }
              for (let c = range.startCol; c <= range.endCol; c++) {
                const colKey = String(c);
                if (cell_updates[rowKey][colKey]) {
                  targetSheet.cellData[rowKey][colKey] = {
                    ...targetSheet.cellData[rowKey][colKey],
                    ...cell_updates[rowKey][colKey],
                  };
                }
              }
            }
          }
          break;
        }
        default:
          return {
            success: false as const,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Build updated content
      const newContent = {
        ...currentContent,
        snapshot: {
          ...currentContent.snapshot,
          sheets,
        },
      };

      // Update the document
      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

      return {
        success: true as const,
        document_id,
        title: document.title,
        operation,
        sheet_id: targetSheetId,
        sheets_count: Object.keys(sheets).length,
        reason: reason ?? `Applied ${operation} operation`,
      };
    },
  });
}
