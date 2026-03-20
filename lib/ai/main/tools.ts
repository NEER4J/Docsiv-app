import { tool } from 'ai';
import { z } from 'zod';

import { createClientRecord } from '@/lib/actions/clients';
import {
  createDocumentRecord,
  updateDocumentRecord,
  upsertDocumentAiChatSession,
} from '@/lib/actions/documents';
import {
  instantiateDocumentTemplate,
  listDocumentTemplates,
} from '@/lib/actions/templates';

/**
 * Experimental tool set for Main AI agent.
 * Note: current production `/api/ai/main` flow is still JSON-action based.
 * Keep this module in sync only when enabling server-side tool execution.
 */
export function getMainAiTools(workspaceId: string) {
  const localCache = new Map<string, unknown>();
  const withCache = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (localCache.has(key)) return localCache.get(key) as T;
    const result = await fn();
    localCache.set(key, result);
    return result;
  };

  return {
    create_client: tool({
      description:
        'Create a new client in the workspace. Use ONLY when no matching client exists. Do not call twice for the same name in one turn.',
      parameters: z.object({
        name: z.string().describe('The client name exactly as the user specified'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ name }) => {
        const key = `create_client:${name.trim().toLowerCase()}`;
        const result = await withCache(key, () => createClientRecord(workspaceId, { name }));
        if (result.error || !result.clientId) {
          return { success: false as const, error: result.error ?? 'Failed to create client' };
        }
        return { success: true as const, clientId: result.clientId, name };
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
        document_type_id: z.string().nullable().describe('Document type ID from the workspace types list, or null'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ title, base_type, client_id, document_type_id }) => {
        const key = `create_document:${title}:${base_type}:${client_id ?? 'none'}:${document_type_id ?? 'none'}`;
        const result = await withCache(key, () =>
          createDocumentRecord(workspaceId, {
            title,
            base_type,
            client_id,
            document_type_id,
          })
        );
        if (result.error || !result.documentId) {
          return { success: false as const, error: result.error ?? 'Failed to create document' };
        }
        return { success: true as const, documentId: result.documentId, title, base_type };
      },
    }),

    create_document_from_template: tool({
      description:
        'Create a new document by instantiating a template. Use when user explicitly wants a template. Do not call create_document in the same turn.',
      parameters: z.object({
        template_id: z.string().describe('The template ID to instantiate'),
        title: z.string().describe('Document title'),
        client_id: z.string().nullable().describe('Client ID to assign, or null'),
        document_type_id: z.string().nullable().describe('Document type ID, or null'),
      }),
      // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
      execute: async ({ template_id, title, client_id, document_type_id }) => {
        const key = `create_document_from_template:${template_id}:${title}:${client_id ?? 'none'}:${document_type_id ?? 'none'}`;
        const result = await withCache(key, () =>
          instantiateDocumentTemplate(workspaceId, template_id, {
            title,
            client_id,
            document_type_id,
          })
        );
        if (result.error || !result.documentId) {
          return {
            success: false as const,
            error: result.error ?? 'Failed to create document from template',
          };
        }
        return { success: true as const, documentId: result.documentId, title, template_id };
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
        const result = await updateDocumentRecord(document_id, { client_id });
        if (result.error) {
          return { success: false as const, error: result.error };
        }
        return { success: true as const, document_id, client_id };
      },
    }),

    seed_editor_ai: tool({
      description:
        'Seed the document editor AI sidebar with a prompt so the editor AI is ready when user opens it. Always call this after create/open.',
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
        const result = await upsertDocumentAiChatSession(document_id, {
          messages: [
            {
              role: 'assistant',
              content: seed_message ?? 'Let me help you with this document.',
            },
          ],
          input: editor_prompt,
        });
        if (result.error) {
          return { success: false as const, error: result.error };
        }
        return { success: true as const, document_id };
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
        const result = await listDocumentTemplates(workspaceId, scope ?? 'all');
        if (result.error) {
          return { success: false as const, error: result.error };
        }
        return {
          success: true as const,
          templates: result.templates.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            base_type: t.base_type,
            is_marketplace: t.is_marketplace,
          })),
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
        const result = await listDocumentTemplates(workspaceId, 'all');
        if (result.error) return { success: false as const, error: result.error };
        const q = query.toLowerCase();
        const scored = result.templates
          .filter((t) => (base_type ? t.base_type === base_type : true))
          .map((t) => {
            const hay = `${t.title} ${t.description ?? ''} ${t.document_types.map((d) => d.name).join(' ')}`.toLowerCase();
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
            id: t.id,
            title: t.title,
            base_type: t.base_type,
            score: Number(score.toFixed(2)),
            reason: t.description ?? 'Template title/type matches the request',
          }));

        return { success: true as const, recommendations: scored };
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
  };
}

export type MainAiTools = ReturnType<typeof getMainAiTools>;
