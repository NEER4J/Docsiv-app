import type { NextRequest } from 'next/server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { logAiUsage } from '@/lib/ai-usage';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const {
    apiKey: key,
    model = DEFAULT_AI_MODEL,
    prompt,
    system,
    workspaceId,
    documentId,
  } = await req.json();

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Google Generative AI API key.' },
      { status: 401 }
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId =
    typeof model === 'string' && model.startsWith('google/')
      ? model.slice(7)
      : model;

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 128,
      model: google(modelId),
      prompt,
      providerOptions:
        modelId.includes('2.5') || modelId.includes('2.0-flash-thinking')
          ? { google: { thinkingConfig: { thinkingBudget: 0 } } }
          : undefined,
      system,
      temperature: 0.3,
    });
    await logAiUsage({
      route: '/api/ai/copilot',
      model: modelId,
      workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
    });

    let text = (result.text ?? '').trim();
    const contextMatch = /"""\s*([\s\S]*?)\s*"""/.exec(prompt);
    const context = contextMatch?.[1]?.trim() ?? '';
    if (context && text) {
      const noPunct = (s: string) => s.replace(/[.,;:?!]\s*$/, '').trim();
      if (noPunct(text) === noPunct(context) || text === context) {
        text = '0';
      }
    }
    return NextResponse.json({
      ...result,
      text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process AI request';
    await logAiUsage({
      route: '/api/ai/copilot',
      model: modelId,
      workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }

    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
