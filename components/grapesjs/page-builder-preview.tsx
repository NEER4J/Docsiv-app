'use client';

import type { GrapesJSStoredContent } from '@/lib/grapesjs-content';

type PageBuilderPreviewProps = {
  content: GrapesJSStoredContent;
  className?: string;
};

/**
 * Renders saved GrapesJS output (HTML + CSS) in read-only mode for shared links.
 */
export function PageBuilderPreview({ content, className = '' }: PageBuilderPreviewProps) {
  const html = content.html ?? '';
  const css = content.css ?? '';

  return (
    <div className={className}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted-foreground">No content yet.</p>' }}
      />
    </div>
  );
}
