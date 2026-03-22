import type { NextRequest } from 'next/server';

import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { getAiModel } from '@/lib/ai/provider';
import { logAiUsage } from '@/lib/ai-usage';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const {
    apiKey: key,
    model,
    prompt,
    system,
    workspaceId,
    documentId,
  } = await req.json();

  let aiModel, modelId: string;
  try {
    ({ model: aiModel, modelId } = await getAiModel('copilot', { apiKey: key, model }));
  } catch {
    return NextResponse.json(
      { error: 'No AI API key configured' },
      { status: 401 }
    );
  }

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 128,
      model: aiModel,
      prompt,
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
