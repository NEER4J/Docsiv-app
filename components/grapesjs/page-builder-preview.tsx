'use client';

import {
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX,
  normalizeToPages,
  type GrapesJSStoredContent,
} from '@/lib/grapesjs-content';

type PageBuilderPreviewProps = {
  content: GrapesJSStoredContent;
  className?: string;
};

/**
 * Renders saved GrapesJS output (HTML + CSS) in read-only mode with fixed page dimensions.
 * Multi-page: each page in a fixed-size box (Venngage/Proposify style). Single-page: one box.
 */
export function PageBuilderPreview({ content, className = '' }: PageBuilderPreviewProps) {
  const pages = normalizeToPages(content);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap"
      />
      <div className="mx-auto flex flex-col items-center gap-6">
        {pages.map((page, i) => (
          <div
            key={i}
            className="shrink-0 bg-white"
            style={{
              width: DOCUMENT_PAGE_WIDTH_PX,
              height: DOCUMENT_PAGE_HEIGHT_PX,
              overflow: 'hidden',
            }}
          >
            {page.css ? <style dangerouslySetInnerHTML={{ __html: page.css }} /> : null}
            <div
              className="prose prose-neutral dark:prose-invert max-w-none px-0"
              dangerouslySetInnerHTML={{
                __html: page.html || '<p class="text-muted-foreground">No content yet.</p>',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
