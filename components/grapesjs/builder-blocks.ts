/**
 * Custom block definitions for the GrapesJS page builder (Reports & Proposals).
 * Add new blocks here or via blockManager.add() at runtime to extend the builder.
 * Use `icon` (Phosphor icon name from https://phosphoricons.com) to show an icon in the block panel.
 */
export interface BuilderBlockDef {
  id: string;
  label: string;
  category: string;
  content: string | Record<string, unknown>;
  activate?: boolean;
  /** Phosphor icon name, e.g. 'TextH', 'Paragraph' */
  icon?: string;
}

export const BUILDER_BLOCKS: BuilderBlockDef[] = [
  // —— Basic ——
  { id: 'section', label: 'Section', category: 'Basic', content: '<section style="padding: 2rem 1rem;"><div class="container"></div></section>', icon: 'Rows' },
  {
    id: 'heading',
    label: 'Heading',
    category: 'Basic',
    content: {
      type: 'text',
      tagName: 'h2',
      content: 'Heading',
      style: { fontFamily: 'Inter, sans-serif' },
      editable: true,
    },
    icon: 'TextH',
  },
  {
    id: 'text-block',
    label: 'Text',
    category: 'Basic',
    content: {
      type: 'text',
      tagName: 'p',
      content: 'Write your text here.',
      style: { fontFamily: 'Inter, sans-serif' },
      editable: true,
    },
    icon: 'Paragraph',
  },
  { id: 'quote-block', label: 'Quote', category: 'Basic', content: '<blockquote style="margin: 0; padding: 1rem 1.5rem; border-left: 4px solid #18181b; background: #f4f4f5; font-family: Inter, sans-serif;"><p style="margin: 0;">Quote or callout text.</p></blockquote>', icon: 'Quotes' },
  { id: 'list-bullet', label: 'Bullet list', category: 'Basic', content: '<ul style="font-family: Inter, sans-serif; margin: 0; padding-left: 1.5rem;"><li>Item one</li><li>Item two</li><li>Item three</li></ul>', icon: 'ListBullets' },
  { id: 'list-numbered', label: 'Numbered list', category: 'Basic', content: '<ol style="font-family: Inter, sans-serif; margin: 0; padding-left: 1.5rem;"><li>First</li><li>Second</li><li>Third</li></ol>', icon: 'ListNumbers' },
  { id: 'divider', label: 'Divider', category: 'Basic', content: '<hr style="border: none; border-top: 1px solid #e4e4e7;" />', icon: 'Minus' },
  { id: 'spacer', label: 'Spacer', category: 'Basic', content: '<div style="height: 2rem;" data-gjs-type="spacer"></div>', icon: 'SpacingVertical' },
  { id: 'button-block', label: 'Button', category: 'Basic', content: '<a href="#" style="display: inline-block; padding: 0.5rem 1rem; background: #18181b; color: #fff; text-decoration: none; border-radius: 0.375rem; font-family: Inter, sans-serif;">Button</a>', icon: 'CursorClick' },
  { id: 'link-block', label: 'Link', category: 'Basic', content: '<a href="#" style="color: #2563eb; text-decoration: underline; font-family: Inter, sans-serif;">Link text</a>', icon: 'Link' },
  // —— Media ——
  { id: 'image', label: 'Image', category: 'Media', content: { type: 'image', attributes: { src: 'https://via.placeholder.com/400x200', alt: 'Image' } }, activate: true, icon: 'Image' },
  { id: 'video', label: 'Video', category: 'Media', content: { type: 'video', tagName: 'video', attributes: { src: '', controls: true }, style: { maxWidth: '100%' } }, icon: 'Video' },
  { id: 'embed-block', label: 'Embed', category: 'Media', content: '<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;"><iframe src="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>', icon: 'Code' },
  // —— Layout ——
  { id: 'columns-2', label: '2 Columns', category: 'Layout', content: '<div class="gjs-columns-wrap" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;"><div></div><div></div></div>', icon: 'Columns' },
  { id: 'columns-3', label: '3 Columns', category: 'Layout', content: '<div class="gjs-columns-wrap" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;"><div></div><div></div><div></div></div>', icon: 'Table' },
  { id: 'card-block', label: 'Card', category: 'Layout', content: '<div style="border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 1.25rem; font-family: Inter, sans-serif;"><h3 style="margin: 0 0 0.5rem 0;">Card title</h3><p style="margin: 0; color: #71717a;">Card description or body text.</p></div>', icon: 'CreditCard' },
];

/** Register all custom blocks with GrapesJS BlockManager. Call after editor init. */
export function registerBuilderBlocks(
  blockManager: { add: (id: string, opts: Record<string, unknown>) => void },
  getIconMedia?: (iconName: string) => string
): void {
  BUILDER_BLOCKS.forEach((block) => {
    const opts: Record<string, unknown> = {
      label: block.label,
      category: block.category,
      content: block.content,
      ...(block.activate !== undefined && { activate: block.activate }),
    };
    if (getIconMedia && block.icon) {
      opts.media = getIconMedia(block.icon);
    }
    blockManager.add(block.id, opts);
  });
}
