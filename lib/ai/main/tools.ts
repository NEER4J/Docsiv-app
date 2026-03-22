import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string | null | undefined): boolean {
  if (!id || id === 'null' || id === 'undefined') return false;
  return UUID_RE.test(id);
}

import { createServiceRoleClient } from '@/lib/supabase/server';
// NOTE: We use authedClient (created before streaming) for RPC calls that need
// auth.uid(), and createServiceRoleClient() for direct table reads (bypasses RLS).
// We do NOT use server actions (createClientRecord, updateDocumentRecord, etc.)
// because they call createClient() → cookies() which hangs during streaming.
import {
  createEditDocumentPlateTool,
  createEditDocumentKonvaTool,
  createEditDocumentUniverTool,
} from './edit-tools';
import { createExportDocumentTool } from './export-tools';
import {
  createManageCollaboratorsTool,
  createCreateShareLinkTool,
  createManageShareLinksTool,
} from './permission-tools';
import { createWebSearchTool, createFetchUrlTool } from '@/lib/ai/web-search-tool';

/**
 * Tool set for Main AI agent.
 * Includes workspace management tools + web search.
 */
export function getMainAiTools(workspaceId: string, userId?: string, authedClient?: SupabaseClient, apiKey?: string) {
  const localCache = new Map<string, unknown>();
  const withCache = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (localCache.has(key)) return localCache.get(key) as T;
    const result = await fn();
    localCache.set(key, result);
    return result;
  };

  // Use authedClient for RPC calls that check auth.uid() (e.g. create_document, create_client).
  // The authedClient was created BEFORE streaming started, so it won't call cookies() again.
  // Fallback to service role client for direct table reads only (bypasses RLS, no auth.uid()).
  const getAuthDb = () => authedClient ?? createServiceRoleClient();
  const getReadDb = () => createServiceRoleClient();

  // Track the last created document so follow-up tools can fall back to it
  // when models pass "undefined" or invalid document_id.
  let lastCreatedDocumentId: string | null = null;
  let lastCreatedClientId: string | null = null;

  /** Resolve document_id: validate, fallback to lastCreatedDocumentId if invalid. */
  function resolveDocumentId(raw: string | null | undefined): string | null {
    if (isValidUuid(raw)) return raw!;
    if (lastCreatedDocumentId) {
      console.warn(`[tools] Received invalid document_id "${raw}", falling back to last created: ${lastCreatedDocumentId}`);
      return lastCreatedDocumentId;
    }
    return null;
  }

  return {
    create_client: tool({
      description:
        'Create a new client in the workspace. Use ONLY when no matching client exists. Do not call twice for the same name in one turn.',
      parameters: z.object({
        name: z.string().describe('The client name exactly as the user specified'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ name }) => {
        try {
          const key = `create_client:${name.trim().toLowerCase()}`;
          const result = await withCache(key, async () => {
            const sb = getAuthDb();
            const { data, error } = await sb.rpc('create_client', {
              p_workspace_id: workspaceId,
              p_name: name,
              p_email: null,
              p_phone: null,
              p_website: null,
              p_notes: null,
            });
            if (error) return { clientId: null as string | null, error: error.message };
            const id = typeof data === 'string' ? data.trim() : '';
            if (!id) return { clientId: null as string | null, error: 'create_client returned no id' };
            return { clientId: id, error: undefined };
          });
          if (result.error || !result.clientId) {
            return { success: false as const, error: result.error ?? 'Failed to create client' };
          }
          lastCreatedClientId = result.clientId;
          return { success: true as const, clientId: result.clientId, name };
        } catch (err) {
          console.error('[create_client] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    create_document: tool({
      description:
        'Create a new blank document (no template). Use when user wants a new document and no template is selected. Do not call if create_document_from_template is used.',
      parameters: z.object({
        title: z.string().describe('Document title'),
        base_type: z
          .enum(['doc', 'sheet', 'presentation', 'contract'])
          .describe('Document type: doc for reports/briefs, sheet for spreadsheets, presentation for decks, contract for contracts/SOWs'),
        client_id: z.string().nullable().describe('Client ID to assign, or null'),
        document_type_id: z
          .string()
          .nullable()
          .describe('Document type UUID from the provided workspace types list only; use null if unknown'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ title, base_type, client_id, document_type_id }) => {
        try {
          // Sanitize IDs — models often pass "null"/"undefined" strings
          const cleanDocTypeId = isValidUuid(document_type_id) ? document_type_id : null;
          const cleanClientId = isValidUuid(client_id) ? client_id : null;
          const key = `create_document:${title}:${base_type}:${cleanClientId ?? 'none'}:${cleanDocTypeId ?? 'none'}`;
          const result = await withCache(key, async () => {
            const sb = getAuthDb();
            let { data, error } = await sb.rpc('create_document', {
              p_workspace_id: workspaceId,
              p_title: title ?? 'Untitled',
              p_base_type: base_type,
              p_document_type_id: cleanDocTypeId,
              p_client_id: cleanClientId,
            });
            // Retry without document_type_id if FK fails (hallucinated type id)
            if (error && cleanDocTypeId && (error.message?.includes('documents_document_type_id_fkey') || error.message?.includes('invalid input syntax'))) {
              const retry = await sb.rpc('create_document', {
                p_workspace_id: workspaceId,
                p_title: title ?? 'Untitled',
                p_base_type: base_type,
                p_document_type_id: null,
                p_client_id: cleanClientId,
              });
              data = retry.data;
              error = retry.error;
            }
            if (error) return { documentId: null as string | null, error: error.message };
            return { documentId: data as string, error: undefined };
          });
          if (result.error || !result.documentId) {
            return { success: false as const, error: result.error ?? 'Failed to create document' };
          }
          // Fetch actual base_type from DB (may differ if document_type overrides it)
          let actualBaseType = base_type;
          try {
            const { data: doc } = await getReadDb().from('documents').select('base_type').eq('id', result.documentId).maybeSingle();
            if (doc?.base_type) actualBaseType = doc.base_type;
          } catch { /* Use requested base_type as fallback */ }
          localCache.set(`create_document:${result.documentId}`, { documentId: result.documentId });
          lastCreatedDocumentId = result.documentId;
          return {
            success: true as const,
            document_id: result.documentId,
            documentId: result.documentId,
            title,
            base_type: actualBaseType,
            edit_tool: actualBaseType === 'sheet' ? 'edit_document_univer' : actualBaseType === 'presentation' || actualBaseType === 'report' ? 'edit_document_konva' : 'edit_document_plate',
          };
        } catch (err) {
          console.error('[create_document] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    create_document_from_template: tool({
      description:
        'Create a new document by instantiating a template. Use when user explicitly wants a template. Do not call create_document in the same turn.',
      parameters: z.object({
        template_id: z.string().describe('The template ID to instantiate'),
        title: z.string().describe('Document title'),
        client_id: z.string().nullable().describe('Client ID to assign, or null'),
        document_type_id: z
          .string()
          .nullable()
          .describe('Document type UUID from the provided workspace types list only; use null if unknown'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ template_id, title, client_id, document_type_id }) => {
        try {
          const cleanDocTypeId = isValidUuid(document_type_id) ? document_type_id : null;
          const cleanClientId = isValidUuid(client_id) ? client_id : null;
          const key = `create_document_from_template:${template_id}:${title}:${cleanClientId ?? 'none'}:${cleanDocTypeId ?? 'none'}`;
          const result = await withCache(key, async () => {
            const sb = getAuthDb();
            const instantiateArgs = {
              p_template_id: template_id,
              p_workspace_id: workspaceId,
              p_title: title ?? null,
              p_client_id: cleanClientId,
              p_document_type_id: cleanDocTypeId,
            };
            let { data, error } = await sb.rpc('instantiate_document_template', instantiateArgs);
            // Retry without document_type_id if FK fails (hallucinated type id)
            if (error && cleanDocTypeId && (error.message?.includes('documents_document_type_id_fkey') || error.message?.includes('invalid input syntax'))) {
              const retry = await sb.rpc('instantiate_document_template', { ...instantiateArgs, p_document_type_id: null });
              data = retry.data;
              error = retry.error;
            }
            if (error) return { documentId: null as string | null, error: error.message };
            return { documentId: data as string, error: undefined };
          });
          if (result.error || !result.documentId) {
            return { success: false as const, error: result.error ?? 'Failed to create document from template' };
          }
          // Fetch actual base_type from DB
          let actualBaseType = 'doc';
          try {
            const { data: doc } = await getReadDb().from('documents').select('base_type').eq('id', result.documentId).maybeSingle();
            if (doc?.base_type) actualBaseType = doc.base_type;
          } catch { /* fallback to doc */ }
          lastCreatedDocumentId = result.documentId;
          return {
            success: true as const,
            document_id: result.documentId,
            documentId: result.documentId,
            title,
            template_id,
            base_type: actualBaseType,
            edit_tool: actualBaseType === 'sheet' ? 'edit_document_univer' : actualBaseType === 'presentation' || actualBaseType === 'report' ? 'edit_document_konva' : 'edit_document_plate',
          };
        } catch (err) {
          console.error('[create_document_from_template] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    assign_client_to_document: tool({
      description:
        'Assign or reassign a client to an existing document. Use when a document already exists and client linkage needs update.',
      parameters: z.object({
        document_id: z.string().describe('The document ID'),
        client_id: z.string().describe('The client ID to assign'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ document_id, client_id }) => {
        try {
          const resolvedDocId = resolveDocumentId(document_id);
          if (!resolvedDocId) return { success: false as const, error: `Invalid document_id: "${document_id}". No recently created document to fall back to.` };
          const { error } = await getAuthDb().rpc('update_document', {
            p_document_id: resolvedDocId,
            p_title: null,
            p_status: null,
            p_client_id: client_id,
            p_document_type_id: null,
            p_require_signature: null,
            p_clear_client_id: false,
            p_thumbnail_url: null,
          });
          if (error) return { success: false as const, error: error.message };
          return { success: true as const, document_id: resolvedDocId, client_id };
        } catch (err) {
          console.error('[assign_client_to_document] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    rename_document: tool({
      description:
        'Rename an existing document. Use when the user wants to change a document title.',
      parameters: z.object({
        document_id: z.string().describe('The document ID to rename'),
        title: z.string().describe('The new title for the document'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ document_id, title }) => {
        try {
          const resolvedDocId = resolveDocumentId(document_id);
          if (!resolvedDocId) return { success: false as const, error: `Invalid document_id: "${document_id}". No recently created document to fall back to.` };
          const { error } = await getAuthDb().rpc('update_document', {
            p_document_id: resolvedDocId,
            p_title: title,
            p_status: null,
            p_client_id: null,
            p_document_type_id: null,
            p_require_signature: null,
            p_clear_client_id: false,
            p_thumbnail_url: null,
          });
          if (error) return { success: false as const, error: error.message };
          return { success: true as const, document_id: resolvedDocId, title };
        } catch (err) {
          console.error('[rename_document] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    seed_editor_ai: tool({
      description:
        'Seed the document editor AI sidebar with a prompt so the editor AI is ready when user opens it. NOTE: This does NOT generate or edit document content — use edit_document_plate/konva/univer for that. Only call this AFTER content has already been generated.',
      parameters: z.object({
        document_id: z.string().describe('The document ID to seed'),
        editor_prompt: z
          .string()
          .describe(
            'The prompt for the editor AI describing what to do with the document content'
          ),
        seed_message: z
          .string()
          .optional()
          .describe('Optional assistant greeting message shown in the editor AI sidebar'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ document_id, editor_prompt, seed_message }) => {
        try {
          const resolvedDocId = resolveDocumentId(document_id);
          if (!resolvedDocId) return { success: false as const, error: `Invalid document_id: "${document_id}". No recently created document to fall back to.` };
          // Use service role for direct table writes (no RPC auth check, bypasses RLS)
          const sb = getReadDb();
          const { error: upsertError } = await sb.from('document_ai_chat_sessions').upsert(
            {
              document_id: resolvedDocId,
              user_id: userId ?? '00000000-0000-0000-0000-000000000000',
              messages: [
                {
                  role: 'assistant',
                  content: seed_message ?? 'Let me help you with this document.',
                },
              ],
              input: typeof editor_prompt === 'string' ? editor_prompt : '',
            },
            { onConflict: 'document_id,user_id' }
          );
          if (upsertError) {
            return { success: false as const, error: upsertError.message };
          }
          // Fetch document title/type/content for UI display and preview
          const { data: doc } = await getReadDb()
            .from('documents')
            .select('title,base_type,content,thumbnail_url')
            .eq('id', resolvedDocId)
            .maybeSingle();
          return {
            success: true as const,
            document_id: resolvedDocId,
            title: doc?.title ?? 'Document',
            base_type: doc?.base_type ?? 'doc',
            updatedContent: doc?.content ?? null,
            thumbnail_url: doc?.thumbnail_url ?? null,
          };
        } catch (err) {
          console.error('[seed_editor_ai] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    list_templates: tool({
      description:
        'List available document templates. Use when the user asks about templates, or when you need to find a matching template for their request.',
      parameters: z.object({
        scope: z
          .enum(['all', 'workspace', 'marketplace'])
          .optional()
          .describe('Filter by scope: all, workspace only, or marketplace only'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ scope }) => {
        try {
          const { data, error } = await getAuthDb().rpc('list_document_templates', {
            p_workspace_id: workspaceId,
            p_scope: scope ?? 'all',
          });
          if (error) return { success: false as const, error: error.message };
          let raw: unknown = data;
          if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
          const arr = Array.isArray(raw) ? raw : [];
          return {
            success: true as const,
            templates: arr.slice(0, 40).map((t: Record<string, unknown>) => ({
              id: String(t.id ?? ''),
              title: String(t.title ?? 'Untitled'),
              description: t.description != null ? String(t.description) : null,
              base_type: String(t.base_type ?? 'doc'),
              is_marketplace: Boolean(t.is_marketplace),
            })),
          };
        } catch (err) {
          console.error('[list_templates] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    process_documents: tool({
      description:
        'Normalize and summarize already-processed document snippets before generation. Use when many attachments are present and you need compact context.',
      parameters: z.object({
        documents: z.array(
          z.object({
            name: z.string(),
            mimeType: z.string(),
            status: z.enum(['ready', 'error']),
            extractedText: z.string().optional(),
            summary: z.string().optional(),
          })
        ),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ documents }) => {
        const ready = documents.filter((d) => d.status === 'ready');
        const failed = documents.filter((d) => d.status === 'error');
        const compact = ready.slice(0, 25).map((d) => {
          const text = (d.extractedText ?? '').trim().slice(0, 800);
          const preview = text.length > 0 ? text : d.summary ?? 'No text extracted';
          return {
            name: d.name,
            mimeType: d.mimeType,
            preview,
          };
        });
        return {
          success: true as const,
          totals: { ready: ready.length, failed: failed.length, all: documents.length },
          documents: compact,
        };
      },
    }),

    recommend_template: tool({
      description:
        'Recommend the most relevant templates for a user request and optional base type.',
      parameters: z.object({
        query: z.string().describe('User intent, e.g. "meta ads monthly report for neeraj"'),
        base_type: z.enum(['doc', 'sheet', 'presentation', 'contract']).optional(),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ query, base_type }) => {
        try {
          const { data, error } = await getAuthDb().rpc('list_document_templates', {
            p_workspace_id: workspaceId,
            p_scope: 'all',
          });
          if (error) return { success: false as const, error: error.message };
          let raw: unknown = data;
          if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
          const templates = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
          const q = query.toLowerCase();
          const scored = templates
            .filter((t) => (base_type ? String(t.base_type ?? 'doc') === base_type : true))
            .map((t) => {
              const dtArr = Array.isArray(t.document_types) ? t.document_types : [];
              const hay = `${t.title ?? ''} ${t.description ?? ''} ${dtArr.map((d: Record<string, unknown>) => d.name ?? '').join(' ')}`.toLowerCase();
              let score = 0;
              if (hay.includes(q)) score += 4;
              for (const tok of q.split(/\s+/).filter(Boolean)) {
                if (hay.includes(tok)) score += 1;
              }
              if (t.is_marketplace) score += 0.2;
              return { t, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(({ t, score }) => ({
              id: String(t.id ?? ''),
              title: String(t.title ?? 'Untitled'),
              base_type: String(t.base_type ?? 'doc'),
              score: Number(score.toFixed(2)),
              reason: t.description ? String(t.description) : 'Template title/type matches the request',
            }));

          return { success: true as const, recommendations: scored };
        } catch (err) {
          console.error('[recommend_template] Tool execution error:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
    }),

    proposal_quality_check: tool({
      description:
        'Quick readiness QA for proposal/report text and structure. Returns score and missing sections.',
      parameters: z.object({
        content: z.string().describe('Proposal/report content to evaluate'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ content }) => {
        const text = content.trim();
        const mustHave = ['introduction', 'scope', 'timeline', 'pricing', 'next step'];
        const missing = mustHave.filter((k) => !text.toLowerCase().includes(k));
        const score = Math.max(0, Math.min(100, 100 - missing.length * 16));
        return {
          success: true as const,
          score,
          missing_sections: missing,
          suggestions:
            missing.length > 0
              ? missing.map((s) => `Add a clear "${s}" section with concrete details.`)
              : ['Structure looks complete. Tighten value proposition and CTA if needed.'],
        };
      },
    }),

    sheet_anomaly_insights: tool({
      description:
        'Detect simple anomalies and trends from numeric sheet rows (kpi/time series).',
      parameters: z.object({
        series: z.array(z.number()).describe('Numeric values ordered by time'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ series }) => {
        if (series.length < 3) {
          return { success: true as const, insights: ['Need at least 3 points for trend/anomaly detection.'] };
        }
        const avg = series.reduce((a, b) => a + b, 0) / series.length;
        const variance = series.reduce((a, b) => a + (b - avg) ** 2, 0) / series.length;
        const std = Math.sqrt(variance);
        const anomalies = series
          .map((v, i) => ({ i, v, z: std > 0 ? Math.abs((v - avg) / std) : 0 }))
          .filter((x) => x.z >= 2)
          .map((x) => ({ index: x.i, value: x.v, zScore: Number(x.z.toFixed(2)) }));
        const direction = series[series.length - 1] >= series[0] ? 'upward' : 'downward';
        return {
          success: true as const,
          insights: [
            `Overall trend is ${direction} from ${series[0]} to ${series[series.length - 1]}.`,
            anomalies.length > 0
              ? `Detected ${anomalies.length} outlier point(s).`
              : 'No significant outliers detected.',
          ],
          anomalies,
        };
      },
    }),

    analyze_layout_image: tool({
      description:
        'Analyze a layout/design image uploaded by the user to extract structure, styling, and layout information. Use when user uploads a layout image and wants to create a document matching that design. Returns layout_type, sections, color_scheme, typography, and suggested document type.',
      parameters: z.object({
        image_data_url: z.string().describe('The base64 data URL of the uploaded layout image (e.g., data:image/png;base64,...)'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ image_data_url }) => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const res = await fetch(`${appUrl}/api/ai/analyze-layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data_url }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false as const,
            error: err.error ?? `Layout analysis failed (${res.status})`,
          };
        }

        const data = await res.json();
        return {
          success: true as const,
          cached: data.cached ?? false,
          layout_type: data.analysis.layout_type as
            | 'report'
            | 'presentation'
            | 'spreadsheet'
            | 'proposal'
            | 'doc'
            | 'contract',
          sections: data.analysis.sections as Array<{
            type: string;
            position?: string;
            height_percent?: number;
            width_percent?: number;
            style?: Record<string, unknown>;
            content?: string;
          }>,
          color_scheme: data.analysis.color_scheme as
            | { primary: string; secondary: string; accent?: string; background?: string; text?: string }
            | undefined,
          typography: data.analysis.typography as
            | { heading_font?: string; body_font?: string; heading_size?: string; body_size?: string }
            | undefined,
          suggested_base_type: data.analysis.suggested_base_type as
            | 'doc'
            | 'sheet'
            | 'presentation'
            | 'contract',
        };
      },
    }),

    // Editor-specific edit tools
    edit_document_plate: createEditDocumentPlateTool(workspaceId, localCache, withCache, userId, authedClient, resolveDocumentId),
    edit_document_konva: createEditDocumentKonvaTool(workspaceId, localCache, withCache, userId, authedClient, resolveDocumentId),
    edit_document_univer: createEditDocumentUniverTool(workspaceId, localCache, withCache, userId, authedClient, resolveDocumentId),

    // Export tool
    export_document: createExportDocumentTool(workspaceId, localCache, withCache),

    // Permission management tools
    manage_collaborators: createManageCollaboratorsTool(workspaceId, localCache, withCache),
    create_share_link: createCreateShareLinkTool(workspaceId, localCache, withCache),
    manage_share_links: createManageShareLinksTool(workspaceId, localCache, withCache),

    // Web search tool — AI autonomously decides when to search the web
    ...(apiKey ? { search_web: createWebSearchTool(apiKey) } : {}),

    // URL fetching tool — reads content from specific URLs
    fetch_url: createFetchUrlTool(),
  };
}

export type MainAiTools = ReturnType<typeof getMainAiTools>;
