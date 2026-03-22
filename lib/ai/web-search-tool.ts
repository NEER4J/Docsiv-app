/**
 * Web search + URL fetch tools that the AI can call autonomously.
 *
 * - search_web: Uses OpenRouter's web search plugin for general queries
 * - fetch_url: Fetches and extracts text content from a specific URL
 */

import { tool } from 'ai';
import { z } from 'zod';

export function createWebSearchTool(apiKey: string) {
  return tool({
    description:
      'Search the web for current, real-time information. Use ONLY when the user asks to search the web generally (e.g. "search for X", "find info about X") and no specific URL is provided. Do NOT use this if the user provides a specific URL — use fetch_url instead.',
    parameters: z.object({
      query: z.string().describe('The search query to look up on the web'),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue
    execute: async ({ query }: { query: string }) => {
      try {
        const res = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer':
                process.env.NEXT_PUBLIC_APP_URL || 'https://docsiv.com',
              'X-Title': 'Docsiv',
            },
            body: JSON.stringify({
              model: 'openai/gpt-4.1-nano',
              messages: [
                {
                  role: 'user',
                  content: `Search the web and provide a comprehensive answer: ${query}`,
                },
              ],
              plugins: [{ id: 'web', max_results: 5 }],
              max_tokens: 1024,
            }),
            signal: AbortSignal.timeout(15_000),
          },
        );

        if (!res.ok) {
          return {
            success: false,
            error: `Web search request failed (${res.status})`,
            query,
          };
        }

        const data = (await res.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              annotations?: Array<{
                type: string;
                url_citation?: {
                  url: string;
                  title: string;
                  content?: string;
                };
              }>;
            };
          }>;
        };

        const message = data.choices?.[0]?.message;
        const answer = message?.content || '';
        const citations = (message?.annotations ?? [])
          .filter((a) => a.type === 'url_citation' && a.url_citation)
          .map((a) => ({
            url: a.url_citation!.url,
            title: a.url_citation!.title,
            snippet: a.url_citation!.content?.slice(0, 300) ?? '',
          }));

        return { success: true, answer, citations, query };
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : 'Web search failed',
          query,
        };
      }
    },
  });
}

/**
 * Fetch and extract text content from a specific URL.
 * Strips HTML tags and returns clean text content.
 */
export function createFetchUrlTool() {
  return tool({
    description:
      'Fetch and read the content of a specific URL/webpage. Use this when the user provides a URL and wants you to read, analyze, or extract information from that page. This actually downloads and reads the page content.',
    parameters: z.object({
      url: z.string().url().describe('The URL to fetch and read'),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue
    execute: async ({ url }: { url: string }) => {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Docsiv/1.0; +https://docsiv.com)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          },
          signal: AbortSignal.timeout(15_000),
          redirect: 'follow',
        });

        if (!res.ok) {
          return {
            success: false,
            error: `Failed to fetch URL (${res.status} ${res.statusText})`,
            url,
          };
        }

        const contentType = res.headers.get('content-type') ?? '';
        const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
        const isText = contentType.includes('text/') || contentType.includes('application/json') || contentType.includes('application/xml');

        if (!isHtml && !isText) {
          return {
            success: false,
            error: `URL returned non-text content (${contentType}). Cannot extract text from binary files.`,
            url,
          };
        }

        const rawText = await res.text();

        let content: string;
        if (isHtml) {
          // Strip HTML tags and extract readable text
          content = rawText
            // Remove script and style blocks entirely
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            // Extract title
            .replace(/<title>(.*?)<\/title>/gi, 'PAGE TITLE: $1\n\n')
            // Extract meta description
            .replace(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/gi, 'DESCRIPTION: $1\n')
            // Convert headings to text with markers
            .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n## $1\n')
            // Convert list items
            .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
            // Convert paragraphs to double newlines
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            // Remove all remaining HTML tags
            .replace(/<[^>]+>/g, '')
            // Decode common HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            // Clean up whitespace
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
        } else {
          content = rawText.trim();
        }

        // Truncate to prevent token explosion
        const MAX_CHARS = 12000;
        const truncated = content.length > MAX_CHARS;
        const finalContent = truncated ? content.slice(0, MAX_CHARS) + '\n\n[Content truncated...]' : content;

        return {
          success: true,
          url,
          content: finalContent,
          contentLength: content.length,
          truncated,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch URL',
          url,
        };
      }
    },
  });
}
