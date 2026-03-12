'use client';

import { DOCUMENT_PAGE_WIDTH_PX, type GrapesJSStoredContent } from '@/lib/grapesjs-content';

type PageBuilderPreviewProps = {
  content: GrapesJSStoredContent;
  className?: string;
};

/**
 * Renders saved GrapesJS output (HTML + CSS) in read-only mode with a fixed page width
 * so layout is consistent across screen sizes (matches editor canvas and PDF export).
 */
export function PageBuilderPreview({ content, className = '' }: PageBuilderPreviewProps) {
  const html = content.html ?? '';
  const css = content.css ?? '';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div
        className="mx-auto min-h-[600px] shrink-0 bg-white"
        style={{ width: DOCUMENT_PAGE_WIDTH_PX }}
      >
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap"
        />
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none px-0"
          dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted-foreground">No content yet.</p>' }}
        />
      </div>
    </div>
  );
}
