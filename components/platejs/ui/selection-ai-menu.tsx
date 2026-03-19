'use client';

import * as React from 'react';
import {
  CheckIcon,
  Loader2Icon,
  RefreshCcwIcon,
  WandSparklesIcon,
  XIcon,
  SparklesIcon,
} from 'lucide-react';
import { KEYS, nanoid, TextApi, type TElement, type Value } from 'platejs';
import { useEditorPlugin, usePluginOption } from 'platejs/react';
import { cn } from '@/lib/utils';
import {
  SelectionAIPlugin,
} from '@/components/platejs/editor/plugins/selection-ai-plugin';
import { Button } from './button';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

// ── Quick action presets ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Make concise', prompt: 'Rewrite this to be more concise and clear.' },
  { label: 'Fix grammar', prompt: 'Fix all grammar and spelling errors.' },
  { label: 'Formal tone', prompt: 'Rewrite this in a professional, formal tone.' },
  { label: 'Casual tone', prompt: 'Rewrite this in a friendly, conversational tone.' },
  { label: 'Expand', prompt: 'Expand this with more detail and explanation.' },
  { label: 'Bullet list', prompt: 'Convert this into a concise bullet-point list.' },
  { label: 'Summarize', prompt: 'Summarize this in 1–2 sentences.' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mark key used by AIPlugin for AILeaf rendering. Must match plugin key. */
const AI_MARK_KEY = typeof KEYS.ai === 'string' ? KEYS.ai : 'ai';

/** Recursively add the `ai` mark to all text leaves so AILeaf renders them. */
function addAIMarks(nodes: Value): Value {
  const mark = (node: Record<string, unknown>): Record<string, unknown> => {
    if (TextApi.isText(node as Parameters<typeof TextApi.isText>[0])) {
      return { ...node, [AI_MARK_KEY]: true };
    }
    if (Array.isArray(node.children)) {
      return { ...node, children: (node.children as Record<string, unknown>[]).map(mark) };
    }
    return node;
  };
  return nodes.map((n) => mark(n as Record<string, unknown>)) as Value;
}


// ── Component ─────────────────────────────────────────────────────────────────

export function SelectionAIMenu() {
  const { editor, setOption } = useEditorPlugin(SelectionAIPlugin);

  const isOpen = usePluginOption(SelectionAIPlugin, 'isOpen');
  const mode = usePluginOption(SelectionAIPlugin, 'mode');
  const anchorEl = usePluginOption(SelectionAIPlugin, 'anchorEl');
  const previewMsg = usePluginOption(SelectionAIPlugin, 'previewMsg');
  // insertedIds is consumed reactively only to keep the component re-rendering in sync
  const insertedIds = usePluginOption(SelectionAIPlugin, 'insertedIds');

  const [prompt, setPrompt] = React.useState('');
  const [error, setError] = React.useState('');
  const abortRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus the input whenever the menu opens in 'input' mode
  React.useEffect(() => {
    if (isOpen && mode === 'input') {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [isOpen, mode]);

  // ── Core: run a prompt ─────────────────────────────────────────────────────

  const runPrompt = React.useCallback(
    async (userPrompt: string) => {
      const trimmed = userPrompt.trim();
      if (!trimmed) return;

      const savedSelection = editor.getOption(SelectionAIPlugin, 'savedSelection');
      const storedOriginalNodes = editor.getOption(SelectionAIPlugin, 'originalNodes');

      if (!savedSelection || !storedOriginalNodes.length) {
        setError('No selection — please select some text first.');
        return;
      }

      setOption('mode', 'loading');
      setError('');

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/ai/selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            selectedContent: storedOriginalNodes,
            prompt: trimmed,
          }),
        });

        const data = (await res.json()) as {
          action: string;
          message?: string;
          content?: Value;
          error?: string;
        };

        if (!res.ok) {
          setError(data?.error ?? 'AI request failed. Please try again.');
          setOption('mode', 'input');
          return;
        }

        // Chat/info response — no edit needed
        if (data.action === 'chat') {
          setOption('previewMsg', data.message ?? '');
          setOption('mode', 'input');
          return;
        }

        // Edit response: insert suggestion nodes with AILeaf marks
        const resultNodes = data.content as Value;
        if (!resultNodes?.length) {
          setError('AI returned empty content. Please try again.');
          setOption('mode', 'input');
          return;
        }

        // Tag each top-level suggestion node with a unique ID and AILeaf marks (ai: true)
        const taggedNodes: TElement[] = addAIMarks(resultNodes).map(
          (n) => ({ ...(n as TElement), id: `ai-sug-${nanoid()}` })
        );
        const newIds = taggedNodes.map((n) => n.id as string);

        // Find the index of the last selected top-level block, then insert right after it.
        let lastBlockIndex = -1;
        for (const [, path] of editor.api.nodes({
          at: savedSelection,
          match: (_n: unknown, p: number[]) => p.length === 1,
        })) {
          const idx = (path as number[])[0];
          if (idx > lastBlockIndex) lastBlockIndex = idx;
        }
        const insertAt = lastBlockIndex >= 0 ? lastBlockIndex + 1 : editor.children.length;

        editor.tf.insertNodes(taggedNodes as Parameters<typeof editor.tf.insertNodes>[0], {
          at: [insertAt],
        });

        setOption('insertedIds', newIds);
        setOption('previewMsg', data.message ?? '');
        setOption('mode', 'preview');

        // After insertion, re-anchor the popover to the LAST inserted block so the
        // menu appears below the generated content instead of overlapping it.
        setTimeout(() => {
          const lastId = newIds[newIds.length - 1];
          for (const [node] of editor.api.nodes({
            at: [],
            match: (n: unknown, p: number[]) =>
              p.length === 1 && (n as Record<string, unknown>).id === lastId,
          })) {
            try {
              const domEl = editor.api.toDOMNode(node as TElement) as HTMLElement | null;
              if (domEl) setOption('anchorEl', domEl);
              domEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch { /* ignore */ }
            break;
          }
        }, 80);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setOption('mode', 'input');
          return;
        }
        setError('Something went wrong. Please try again.');
        setOption('mode', 'input');
        console.error('[SelectionAIMenu]', err);
      }
    },
    [editor, setOption]
  );

  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      void runPrompt(prompt);
    },
    [prompt, runPrompt]
  );

  // ── Remove suggestion nodes (shared by Discard & Retry) ────────────────────

  const removeSuggestion = React.useCallback(() => {
    const ids = editor.getOption(SelectionAIPlugin, 'insertedIds');
    for (const id of [...ids].reverse()) {
      try {
        editor.tf.removeNodes({
          match: (n: unknown) => (n as Record<string, unknown>).id === id,
          at: [],
        });
      } catch { /* ignore */ }
    }
    setOption('insertedIds', []);
  }, [editor, setOption]);

  // ── Accept ─────────────────────────────────────────────────────────────────

  const handleAccept = React.useCallback(() => {
    const ids = editor.getOption(SelectionAIPlugin, 'insertedIds');
    const aiKey = AI_MARK_KEY;

    // 1. Unset the `ai` marks from the inserted suggestion nodes so the
    //    AILeaf highlight is removed and content becomes plain text.
    for (const id of ids) {
      for (const [, path] of editor.api.nodes({
        at: [],
        match: (n: unknown, p: number[]) =>
          p.length === 1 && (n as Record<string, unknown>).id === id,
      })) {
        editor.tf.unsetNodes(aiKey, {
          at: path as number[],
          match: (n: unknown) =>
            TextApi.isText(n as Parameters<typeof TextApi.isText>[0]) &&
            !!(n as Record<string, unknown>)[aiKey],
        });
        break;
      }
    }

    // 2. Delete the original selected blocks identified by their node IDs.
    //    Using IDs rather than re-querying from the saved selection range avoids
    //    accidentally deleting adjacent blocks (e.g. when the selection ends at
    //    offset 0 of the next block).
    const origNodes = editor.getOption(SelectionAIPlugin, 'originalNodes');
    const origIds = origNodes
      .map((n) => (n as Record<string, unknown>).id)
      .filter(Boolean) as string[];

    if (origIds.length) {
      // Collect current paths for original blocks
      const entries: number[][] = [];
      for (const id of origIds) {
        for (const [, path] of editor.api.nodes({
          at: [],
          match: (n: unknown, p: number[]) =>
            p.length === 1 && (n as Record<string, unknown>).id === id,
        })) {
          entries.push(path as number[]);
          break;
        }
      }
      // Remove descending so earlier indices don't shift later ones
      for (const path of [...entries].sort((a, b) => b[0] - a[0])) {
        try { editor.tf.removeNodes({ at: path }); } catch { /* ignore */ }
      }
    }

    setOption('isOpen', false);
    setOption('insertedIds', []);
    setOption('mode', 'input');
  }, [editor, setOption]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = React.useCallback(() => {
    removeSuggestion();
    setOption('isOpen', false);
    setOption('mode', 'input');
  }, [removeSuggestion, setOption]);

  // ── Retry ──────────────────────────────────────────────────────────────────

  const handleRetry = React.useCallback(() => {
    removeSuggestion();
    setOption('mode', 'input');
    setError('');
    setPrompt('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [removeSuggestion, setOption]);

  // ── Close ──────────────────────────────────────────────────────────────────

  const handleOpenChange = React.useCallback(
    (v: boolean) => {
      if (!v) {
        abortRef.current?.abort();
        // Closing while preview is active = Discard (remove suggestion)
        if (mode === 'preview') {
          const ids = editor.getOption(SelectionAIPlugin, 'insertedIds');
          for (const id of [...ids].reverse()) {
            try {
              editor.tf.removeNodes({
                match: (n: unknown) => (n as Record<string, unknown>).id === id,
                at: [],
              });
            } catch { /* ignore */ }
          }
          setOption('insertedIds', []);
        }
        setOption('isOpen', false);
        setOption('mode', 'input');
      }
    },
    [editor, mode, setOption]
  );

  // Don't render anything if anchor is missing
  if (!anchorEl && isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Popover modal={false} open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor virtualRef={{ current: anchorEl! }} />

      <PopoverContent
        className={cn(
          'w-80 p-3',
          (mode === 'loading' || mode === 'preview') && 'selection-ai-fixed-toolbar'
        )}
        side="bottom"
        align="start"
        sideOffset={mode === 'preview' ? 12 : 8}
        style={
          mode === 'loading' || mode === 'preview'
            ? { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'min(20rem, calc(100vw - 2rem))' }
            : undefined
        }
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={() => handleOpenChange(false)}
      >
        {/* ── Loading: compact single line ──────────────────── */}
        {mode === 'loading' && (
          <div className="flex items-center gap-2 py-0.5">
            <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Thinking…</span>
          </div>
        )}

        {/* ── Preview ───────────────────────────────────────── */}
        {mode === 'preview' && (
          <div className="space-y-3">
            {/* Hint */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SparklesIcon className="size-3 shrink-0 text-purple-500" />
              <span>
                {previewMsg
                  ? previewMsg
                  : 'AI suggestion shown highlighted below the original.'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" className="gap-1.5" onClick={handleAccept}>
                  <CheckIcon className="size-3" />
                  Accept
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDiscard}>
                  <XIcon className="size-3" />
                  Discard
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs gap-1.5"
                onClick={handleRetry}
              >
                <RefreshCcwIcon className="size-3" />
                Try a different prompt
              </Button>
            </div>
          </div>
        )}

        {/* ── Input / quick actions ─────────────────────────── */}
        {mode === 'input' && (
          <div className="space-y-2.5">
            {/* AI info message if previous response was chat */}
            {previewMsg && mode === 'input' && (
              <div className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                {previewMsg}
              </div>
            )}

            {/* Quick action chips */}
            <div className="flex flex-wrap gap-1">
              {QUICK_ACTIONS.map(({ label, prompt: p }) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-full border border-border bg-background px-2.5 py-0.5',
                    'text-[11px] text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20'
                  )}
                  onClick={() => {
                    setPrompt(p);
                    void runPrompt(p);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-popover px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Custom prompt */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                ref={inputRef}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-1.5',
                  'text-sm placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-1 focus:ring-ring'
                )}
                placeholder="Custom instruction…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                size="sm"
                className="w-full gap-1.5"
                type="submit"
                disabled={!prompt.trim()}
              >
                <WandSparklesIcon className="size-3" />
                Apply to selection
              </Button>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
