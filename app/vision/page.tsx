import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand Vision & Guidelines',
  description: 'The complete brand identity, product context, and technical guidelines for Docsiv.',
};

/* ─── DATA ── */

const notionColors = [
  { name: 'Default', text: '#37352f', bg: '#f2f2f2' },
  { name: 'Gray',    text: '#9b9a97', bg: '#f2f2f2' },
  { name: 'Brown',   text: '#64473a', bg: '#f2f2f2' },
  { name: 'Orange',  text: '#d9730d', bg: '#faebdd' },
  { name: 'Yellow',  text: '#dfab01', bg: '#fbf3db' },
  { name: 'Green',   text: '#0f7b6c', bg: '#ddedea' },
  { name: 'Blue',    text: '#0b6e99', bg: '#ddebf1' },
  { name: 'Purple',  text: '#6940a5', bg: '#eae4f2' },
  { name: 'Pink',    text: '#ad1a72', bg: '#f4dfeb' },
  { name: 'Red',     text: '#e03e3e', bg: '#fbe4e4' },
];

const brandColors = [
  { name: 'Ink',      variable: '--ink',      hex: '#0A0A0A', rgb: '10, 10, 10',    usage: 'Primary text, buttons, strong UI chrome' },
  { name: 'Paper',    variable: '--paper',    hex: '#FFFFFF', rgb: '255, 255, 255', usage: 'Page backgrounds, reversed text on dark' },
  { name: 'Warm Mid', variable: '--warm-mid', hex: '#171717', rgb: '23, 23, 23', usage: 'Subtle backgrounds, section separators'   },
  { name: 'Muted',    variable: '--muted',    hex: '#171717', rgb: '23, 23, 23',  usage: 'Secondary text, captions, labels'         },
];

const marketingTypeScale = [
  { role: 'Display / H1', font: 'Playfair Display', weight: '900', size: 'clamp(3.5rem, 7vw, 6.5rem)', tracking: '−0.03em', usage: 'Page headlines, hero copy' },
  { role: 'Heading / H2', font: 'Playfair Display', weight: '700', size: '2rem – 2.5rem',               tracking: '−0.02em', usage: 'Section titles' },
  { role: 'Heading / H3', font: 'Playfair Display', weight: '700', size: '1.1rem',                      tracking: '−0.01em', usage: 'Feature titles, pull quotes' },
  { role: 'Body',          font: 'DM Sans',          weight: '300', size: '1rem',                        tracking: '0',       usage: 'Paragraph copy, descriptions' },
  { role: 'Caption',       font: 'DM Sans',          weight: '400–500', size: '0.72rem – 0.85rem',      tracking: '+0.12em – +0.20em', usage: 'Labels, tags, footnotes' },
  { role: 'Button',        font: 'DM Sans',          weight: '500', size: '0.85rem',                    tracking: '+0.05em', usage: 'CTAs, interactive labels' },
];

const dashboardTypeScale = [
  { role: 'Page Title',    font: 'Plus Jakarta Sans', weight: '700', size: '1.5rem – 1.75rem', tracking: '−0.02em', usage: 'Dashboard page headings, modal titles' },
  { role: 'Section Head',  font: 'Plus Jakarta Sans', weight: '600', size: '1rem – 1.125rem',  tracking: '−0.01em', usage: 'Card titles, sidebar sections, table headers' },
  { role: 'UI Label',      font: 'Plus Jakarta Sans', weight: '500', size: '0.8rem – 0.875rem',tracking: '0',       usage: 'Form labels, nav items, button text' },
  { role: 'Body / Data',   font: 'DM Sans',           weight: '400', size: '0.875rem',         tracking: '0',       usage: 'Table data, input values, descriptions' },
  { role: 'Caption',       font: 'DM Sans',           weight: '400', size: '0.75rem',          tracking: '+0.02em', usage: 'Timestamps, meta info, helper text' },
];

const voiceTraits = [
  { trait: 'Precise',      color: '#faebdd', text: '#d9730d',
    desc: 'We use exact language. No filler words, no vague promises.',
    eg: '"Proposals in minutes, not hours." — not "super fast proposals."' },
  { trait: 'Confident',    color: '#eae4f2', text: '#6940a5',
    desc: 'We speak with conviction. We know the problem and state it plainly.',
    eg: '"Clients never see Docsiv. They see you." — clear, not hedged.' },
  { trait: 'Agency-First', color: '#ddedea', text: '#0f7b6c',
    desc: 'We speak the language of agencies: retainers, deliverables, client relationships.',
    eg: '"Your logo, your domain, your brand." — ownership-forward.' },
  { trait: 'Editorial',    color: '#fbf3db', text: '#dfab01',
    desc: 'Our writing has rhythm. Em-dashes, fragments, and short statements are intentional.',
    eg: '"Every doc. One hub. Your brand." — cadence matters.' },
];

const docTypeMap = [
  { type: 'Proposal',   lib: 'Custom (Konva)', color: '#ddebf1', text: '#0b6e99', reason: 'Custom visual editor on Konva; drag-and-drop layout for winning business' },
  { type: 'Report',     lib: 'Custom (Konva)', color: '#ddedea', text: '#0f7b6c', reason: 'Custom multi-page report editor built on react-konva' },
  { type: 'Sheet',      lib: 'Univer',        color: '#ddedea', text: '#0f7b6c', reason: 'Spreadsheet data, budgets, trackers; full Univer sheet editor with import/export' },
  { type: 'Contract',   lib: 'Plate.js',      color: '#fbf3db', text: '#dfab01', reason: 'Text-heavy, structured, precise editing control' },
  { type: 'Deck',       lib: 'Custom (Konva)', color: '#eae4f2', text: '#6940a5', reason: 'Custom presentation editor on Konva; shapes, slides, PDF export' },
  { type: 'SOW',        lib: 'Plate.js',      color: '#fbf3db', text: '#dfab01', reason: 'Statement of work; structured, precise editing' },
  { type: 'Brief',      lib: 'Plate.js',      color: '#faebdd', text: '#d9730d', reason: 'Structured input, collaborative block editing' },
  { type: 'Document',   lib: 'Plate.js',      color: '#f2f2f2', text: '#64473a', reason: 'General docs, meeting notes, playbooks; modular blocks' },
];

const integrations = [
  { name: 'Google Analytics',     cat: 'Data',       color: '#faebdd', text: '#d9730d' },
  { name: 'Meta Ads',             cat: 'Data',       color: '#faebdd', text: '#d9730d' },
  { name: 'Google Ads',           cat: 'Data',       color: '#faebdd', text: '#d9730d' },
  { name: 'Google Search Console',cat: 'Data',       color: '#faebdd', text: '#d9730d' },
  { name: 'Google Drive',         cat: 'Import',     color: '#ddebf1', text: '#0b6e99' },
  { name: 'Notion',               cat: 'Import',     color: '#ddebf1', text: '#0b6e99' },
  { name: 'Stripe',               cat: 'Finance',    color: '#eae4f2', text: '#6940a5' },
  { name: 'HubSpot',              cat: 'CRM',        color: '#ddedea', text: '#0f7b6c' },
  { name: 'Salesforce',           cat: 'CRM',        color: '#ddedea', text: '#0f7b6c' },
  { name: 'Zapier',               cat: 'Automation', color: '#f2f2f2', text: '#64473a' },
  { name: 'Slack / Teams',        cat: 'Notify',     color: '#f2f2f2', text: '#9b9a97' },
  { name: 'Resend / SendGrid',    cat: 'Email',      color: '#f2f2f2', text: '#9b9a97' },
];

const coreFeatures = [
  { n: '01', label: 'AI Document Creation',   color: '#ddebf1', text: '#0b6e99', desc: 'Turn meeting notes or raw data into polished, client-ready documents in minutes.' },
  { n: '02', label: 'Every Document Type',    color: '#ddedea', text: '#0f7b6c', desc: 'Proposals, reports, sheets, decks, contracts, SOWs, briefs, documents — all in one place.' },
  { n: '03', label: 'White-Label by Default', color: '#eae4f2', text: '#6940a5', desc: 'Your logo, your colors, your domain. Clients never see Docsiv; they see you.' },
  { n: '04', label: 'Branded Client Portal',  color: '#fbf3db', text: '#dfab01', desc: 'One link. Every document you\'ve ever sent, organised in a beautiful branded space.' },
  { n: '05', label: 'Document Analytics',     color: '#faebdd', text: '#d9730d', desc: 'Know when clients open, read, and engage with what you send them.' },
  { n: '06', label: 'AI Chat with Documents', color: '#fbe4e4', text: '#e03e3e', desc: 'Ask questions, extract insights from any document. No digging, no rereading.' },
];

const libraries = [
  { name: 'Custom editor (Konva)', url: 'konvajs.org',       badge: 'Editor',        color: '#ddebf1', text: '#0b6e99', desc: 'Custom visual editor built on react-konva: proposals, reports, case studies, strategy decks.' },
  { name: 'Plate.js',              url: 'platejs.org',       badge: 'Editor',        color: '#ddedea', text: '#0f7b6c', desc: 'Rich-text block editor for SOWs, contracts, briefs, docs.' },
  { name: 'Univer',                url: 'univer.ai',         badge: 'Sheets',        color: '#ddedea', text: '#0f7b6c', desc: 'Spreadsheet editor for sheets: formulas, validation, import/export.' },
  { name: 'Phosphor Icons',        url: 'phosphoricons.com', badge: 'Icons',        color: '#fbf3db', text: '#dfab01', desc: 'Light weight, size 40 base. Used throughout the UI.' },
  { name: 'Tailwind CSS',          url: 'tailwindcss.com',   badge: 'Styling',      color: '#faebdd', text: '#d9730d', desc: 'v4 with @import syntax. Utility-first, no config file.' },
  { name: 'Next.js',                url: 'nextjs.org',       badge: 'Framework',    color: '#f2f2f2', text: '#37352f', desc: 'App router, server components, React framework.' },
  { name: 'Resend',                url: 'resend.com',         badge: 'Email',        color: '#f2f2f2', text: '#37352f', desc: 'Transactional email for waitlist + doc delivery. Active.' },
];

/* ─── SMALL HELPERS ── */

function Chip({ children, color, text }: { children: React.ReactNode; color: string; text: string }) {
  return (
    <span className="inline-flex items-center text-[0.65rem] font-medium font-[family-name:var(--font-dm-sans)] tracking-[0.08em] px-2 py-0.5 rounded-md"
      style={{ background: color, color: text }}>
      {children}
    </span>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-playfair)] text-2xl md:text-3xl font-bold tracking-[-0.02em] text-[var(--ink)] mb-3">
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-6">
      {children}
    </p>
  );
}

function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-[family-name:var(--font-dm-sans)] text-[0.95rem] font-light leading-relaxed text-[var(--muted)] ${className}`}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--warm-mid)] my-16" />;
}

/* ─── PAGE ── */

export default function VisionPage() {
  return (
    <>
      <nav className="cs-nav">
        <a href="/" className="cs-logo cs-logo-with-icon flex items-center gap-2">
          <img src="/docsiv-icon.png" alt="" width={28} height={28} className="cs-logo-icon" />
          Docsiv
        </a>
        <span className="cs-nav-tag">Brand & Product Context</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 md:px-10 pt-28 pb-32">

        {/* ── COVER ── */}
        <section className="pt-16 pb-20">
          <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-8">
            Brand Vision & Product Context · v1.0 · March 2026
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-[clamp(2.8rem,7vw,5.5rem)] font-black leading-[1.02] tracking-[-0.03em] text-[var(--ink)] mb-6">
            Everything you need to know<br />
            <em>about Docsiv.</em>
          </h1>
          <Body className="max-w-xl mb-10">
            This page is the single source of truth for Docsiv — brand identity, product positioning, design system, tech stack, and tone of voice. Reference it for anything.
          </Body>
          {/* TOC */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {[
              ['Product Overview', '#product'],
              ['Brand Story',      '#brand'],
              ['Colours',          '#colours'],
              ['Typography',       '#type'],
              ['Tone of Voice',    '#voice'],
              ['Logo',             '#logo'],
              ['Tech Stack',       '#tech'],
              ['Core Features',    '#features'],
              ['Integrations',     '#integrations'],
              ["Do's & Don'ts",   '#rules'],
              ['Build Roadmap',    '#roadmap'],
            ].map(([label, href]) => (
              <a key={label} href={href}
                className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] hover:text-[var(--ink)] py-1.5 transition-colors">
                → {label}
              </a>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 01 PRODUCT ── */}
        <section id="product" className="py-4">
          <Label>01 — Product Overview</Label>
          <H2>What is Docsiv?</H2>
          <Body className="max-w-2xl mb-10">
            An AI-powered document hub built specifically for agencies. One platform where agencies create, brand, and deliver every client-facing document — under their own name.{' '}
            <a href="https://www.docsiv.com" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline underline-offset-2">docsiv.com</a>
          </Body>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <div className="rounded-xl p-6" style={{ background: '#fbe4e4' }}>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-3" style={{ color: '#e03e3e' }}>The Problem</p>
              <p className="font-[family-name:var(--font-playfair)] text-base font-bold mb-2 leading-snug" style={{ color: '#e03e3e' }}>4–5 disconnected tools for client documents.</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light leading-relaxed" style={{ color: '#e03e3e' }}>
                Proposals in PandaDoc, reports in Looker Studio, briefs in Google Docs, contracts somewhere else. No consistent branding, no unified client experience.
              </p>
            </div>
            <div className="rounded-xl p-6" style={{ background: '#ddedea' }}>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-3" style={{ color: '#0f7b6c' }}>The Solution</p>
              <p className="font-[family-name:var(--font-playfair)] text-base font-bold mb-2 leading-snug" style={{ color: '#0f7b6c' }}>One hub. Every document. Fully branded.</p>
              <ul className="space-y-1.5">
                {['AI generates from raw input', 'Your brand applied automatically', 'Client receives via your branded portal', 'See when they opened and read it'].map(i => (
                  <li key={i} className="font-[family-name:var(--font-dm-sans)] text-sm font-light flex items-start gap-2" style={{ color: '#0f7b6c' }}>
                    <span className="mt-0.5 flex-shrink-0">→</span>{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: '#fbf3db' }}>
            <p className="font-[family-name:var(--font-playfair)] text-base italic" style={{ color: '#dfab01' }}>
              <strong className="not-italic font-bold">Positioning:</strong> Not a proposal tool. Not a client portal. Not a report builder. All three, combined, with AI at the centre.
            </p>
          </div>

          <div className="mt-8">
            <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-3">Built for</p>
            <div className="flex flex-wrap gap-2">
              {['Digital Agencies', 'Marketing Agencies', 'Consultancies', 'Freelancers'].map(t => (
                <Chip key={t} color="#f2f2f2" text="#37352f">{t}</Chip>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── 02 BRAND STORY ── */}
        <section id="brand" className="py-4">
          <Label>02 — Brand Story & Philosophy</Label>
          <div className="grid md:grid-cols-2 gap-12 mb-12">
            <div>
              <H2>Mission</H2>
              <Body className="mb-6">
                Docsiv exists to eliminate the gap between the work agencies do and the documents they produce to represent it. The proposal that wins the client should be as good as the strategy behind it.
              </Body>
              <H2>Vision</H2>
              <Body>
                A world where every agency presents itself with the polish of a global firm. Where documents are a competitive advantage, not an administrative burden.
              </Body>
            </div>
            <div>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Core Values</p>
              <div className="space-y-2">
                {[
                  { v: 'Craft',   d: 'Every detail is intentional. Quality is not optional.',         c: '#ddebf1', t: '#0b6e99' },
                  { v: 'Agency',  d: 'The people we build for own their work and their brand.',        c: '#ddedea', t: '#0f7b6c' },
                  { v: 'Clarity', d: 'Simple, direct, no noise. In product and in language.',          c: '#eae4f2', t: '#6940a5' },
                  { v: 'Trust',   d: 'Clients trust agencies. Agencies trust Docsiv.',                 c: '#fbf3db', t: '#dfab01' },
                ].map(({ v, d, c, t }) => (
                  <div key={v} className="flex gap-3 rounded-lg p-4" style={{ background: c }}>
                    <span className="font-[family-name:var(--font-playfair)] text-sm font-bold min-w-[58px]" style={{ color: t }}>{v}</span>
                    <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light leading-relaxed" style={{ color: t }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl p-6" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg md:text-xl italic leading-relaxed text-[var(--ink)]">
              &ldquo;We build the tools agencies need to look as good as they work — and to keep their name on everything they deliver.&rdquo;
            </p>
          </div>
        </section>

        <Divider />

        {/* ── 03 COLOURS ── */}
        <section id="colours" className="py-4">
          <Label>03 — Colour Palette</Label>
          <H2>Brand Colours</H2>
          <Body className="mb-8 max-w-xl">
            A restrained, high-contrast palette. Documents never compete with the agency&apos;s own branding. Four tokens cover the entire brand.
          </Body>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {brandColors.map(c => (
              <div key={c.name} className="rounded-xl overflow-hidden">
                <div className="h-24 rounded-xl mb-3" style={{ background: c.hex, outline: c.hex === '#FFFFFF' ? '1px solid #e5e5e5' : 'none' }} />
                <p className="font-[family-name:var(--font-playfair)] text-sm font-bold text-[var(--ink)] mb-0.5">{c.name}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-xs font-medium text-[var(--ink)] font-mono mb-0.5">{c.hex}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] text-[var(--muted)] font-mono mb-1">{c.variable}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)] leading-snug">{c.usage}</p>
              </div>
            ))}
          </div>

          {/* ratio bar */}
          <div className="mb-14">
            <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-2">Usage Ratio</p>
            <div className="flex h-10 rounded-xl overflow-hidden">
              <div className="flex-[5] flex items-center justify-center" style={{ background: '#fff', outline: '1px solid #e5e5e5' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium uppercase tracking-widest text-[var(--ink)]">Paper 50%</span>
              </div>
              <div className="flex-[3] flex items-center justify-center" style={{ background: '#f2f2f2' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium uppercase tracking-widest text-[var(--ink)]">Warm 30%</span>
              </div>
              <div className="flex-[2] flex items-center justify-center" style={{ background: '#0a0a0a' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium uppercase tracking-widest text-white">Ink 20%</span>
              </div>
            </div>
          </div>

          <H2>Notion-Inspired Accent Palette</H2>
          <Body className="mb-6 max-w-xl">
            Inspired by Notion&apos;s colour system — soft background tints with saturated text. Used for tags, badges, callouts, and category chips throughout the UI. No borders.
          </Body>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-6">
            {notionColors.map(c => (
              <div key={c.name} className="rounded-xl p-3" style={{ background: c.bg }}>
                <p className="font-[family-name:var(--font-playfair)] text-sm font-bold mb-1" style={{ color: c.text }}>{c.name}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-mono leading-relaxed" style={{ color: c.text }}>
                  {c.text}<br />{c.bg}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">CSS variables:</span>{' '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">--notion-[name]</code> and{' '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">--notion-[name]-bg</code> in globals.css.
              Tailwind: <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">bg-[var(--notion-blue-bg)]</code>
            </p>
          </div>
        </section>

        <Divider />

        {/* ── 04 TYPOGRAPHY ── */}
        <section id="type" className="py-4">
          <Label>04 — Typography</Label>
          <H2>Three typefaces. Each with a job.</H2>
          <Body className="mb-10 max-w-xl">
            Playfair Display owns the brand and marketing layer. Plus Jakarta Sans handles all product UI headings. DM Sans is the reading and data font throughout.
          </Body>

          {/* Specimens */}
          <div className="grid md:grid-cols-3 gap-3 mb-12">
            <div className="rounded-xl p-7" style={{ background: '#f2f2f2' }}>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Playfair Display</p>
              <p className="font-[family-name:var(--font-playfair)] text-6xl font-black leading-none text-[var(--ink)] mb-3">Aa</p>
              <p className="font-[family-name:var(--font-playfair)] text-xs leading-loose text-[var(--muted)] mb-3">A B C D E F G H I J K L M<br />N O P Q R S T U V W X Y Z</p>
              <p className="font-[family-name:var(--font-playfair)] text-xs text-[var(--muted)] mb-1">400 · 700 · 900 · Italic</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-mono text-[var(--muted)]">var(--font-playfair)</p>
              <div className="mt-3 rounded-md px-2.5 py-1 inline-block" style={{ background: '#ddebf1' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.6rem] font-medium uppercase tracking-[0.1em]" style={{ color: '#0b6e99' }}>Marketing</span>
              </div>
            </div>
            <div className="rounded-xl p-7" style={{ background: '#f2f2f2' }}>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Plus Jakarta Sans</p>
              <p className="font-[family-name:var(--font-ui)] text-6xl font-bold leading-none text-[var(--ink)] mb-3">Aa</p>
              <p className="font-[family-name:var(--font-ui)] text-xs leading-loose text-[var(--muted)] mb-3">A B C D E F G H I J K L M<br />N O P Q R S T U V W X Y Z</p>
              <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--muted)] mb-1">400 · 500 · 600 · 700</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-mono text-[var(--muted)]">var(--font-ui)</p>
              <div className="mt-3 rounded-md px-2.5 py-1 inline-block" style={{ background: '#ddedea' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.6rem] font-medium uppercase tracking-[0.1em]" style={{ color: '#0f7b6c' }}>Dashboard</span>
              </div>
            </div>
            <div className="rounded-xl p-7" style={{ background: '#f2f2f2' }}>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">DM Sans</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-6xl font-light leading-none text-[var(--ink)] mb-3">Aa</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-xs font-light leading-loose text-[var(--muted)] mb-3">A B C D E F G H I J K L M<br />N O P Q R S T U V W X Y Z</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--muted)] mb-1">Light 300 · Regular 400 · Medium 500</p>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-mono text-[var(--muted)]">var(--font-dm-sans)</p>
              <div className="mt-3 rounded-md px-2.5 py-1 inline-block" style={{ background: '#f2f2f2' }}>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.6rem] font-medium uppercase tracking-[0.1em]" style={{ color: '#9b9a97' }}>Both</span>
              </div>
            </div>
          </div>

          {/* Marketing scale */}
          <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-3">Marketing / Brand type scale</p>
          <div className="mb-10">
            <div className="grid grid-cols-6 py-2">
              {['Role', 'Typeface', 'Weight', 'Size', 'Tracking', 'Usage'].map(h => (
                <span key={h} className="font-[family-name:var(--font-dm-sans)] text-[0.6rem] font-medium tracking-[0.1em] uppercase text-[var(--muted)]">{h}</span>
              ))}
            </div>
            <div className="h-px bg-[var(--warm-mid)]" />
            {marketingTypeScale.map((t, i) => (
              <div key={t.role} className={`grid grid-cols-6 py-3 rounded-lg ${i % 2 === 1 ? 'bg-[#f2f2f2]' : ''}`}>
                <span className="font-[family-name:var(--font-playfair)] text-sm font-bold text-[var(--ink)]">{t.role}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.font}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.weight}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.72rem] font-mono text-[var(--ink)]">{t.size}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.72rem] font-mono text-[var(--ink)]">{t.tracking}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.usage}</span>
              </div>
            ))}
          </div>

          {/* Dashboard scale */}
          <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-3">Dashboard / Product UI type scale</p>
          <div className="mb-8">
            <div className="grid grid-cols-6 py-2">
              {['Role', 'Typeface', 'Weight', 'Size', 'Tracking', 'Usage'].map(h => (
                <span key={h} className="font-[family-name:var(--font-dm-sans)] text-[0.6rem] font-medium tracking-[0.1em] uppercase text-[var(--muted)]">{h}</span>
              ))}
            </div>
            <div className="h-px bg-[var(--warm-mid)]" />
            {dashboardTypeScale.map((t, i) => (
              <div key={t.role} className={`grid grid-cols-6 py-3 rounded-lg ${i % 2 === 1 ? 'bg-[#f2f2f2]' : ''}`}>
                <span className="font-[family-name:var(--font-ui)] text-sm font-semibold text-[var(--ink)]">{t.role}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.font}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.weight}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.72rem] font-mono text-[var(--ink)]">{t.size}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[0.72rem] font-mono text-[var(--ink)]">{t.tracking}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-xs font-light text-[var(--muted)]">{t.usage}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-5" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">Tailwind usage:</span>{' '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">font-[family-name:var(--font-playfair)]</code>{' · '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">font-[family-name:var(--font-ui)]</code>{' · '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">font-[family-name:var(--font-dm-sans)]</code>
            </p>
          </div>
        </section>

        <Divider />

        {/* ── 05 VOICE ── */}
        <section id="voice" className="py-4">
          <Label>05 — Tone of Voice</Label>
          <H2>Direct. Precise. Agency-first.</H2>
          <Body className="mb-10 max-w-xl">
            We communicate like a trusted senior colleague — direct, knowledgeable, respectful of the audience&apos;s intelligence. We never over-explain.
          </Body>
          <div className="grid md:grid-cols-2 gap-3 mb-12">
            {voiceTraits.map(v => (
              <div key={v.trait} className="rounded-xl p-5" style={{ background: v.color }}>
                <p className="font-[family-name:var(--font-playfair)] text-base font-bold mb-1.5" style={{ color: v.text }}>{v.trait}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light leading-relaxed mb-2" style={{ color: v.text }}>{v.desc}</p>
                <p className="font-[family-name:var(--font-playfair)] text-sm italic leading-relaxed" style={{ color: v.text }}>{v.eg}</p>
              </div>
            ))}
          </div>

          <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">We say / We don&apos;t say</p>
          <div className="space-y-0">
            <div className="grid grid-cols-2 py-2">
              <span className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[var(--ink)]">✓ We say</span>
              <span className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">✗ Not this</span>
            </div>
            <div className="h-px bg-[var(--warm-mid)]" />
            {[
              ['AI-powered document hub',          'Revolutionary AI platform'],
              ['Proposals, reports, briefs',        'A variety of document types'],
              ['Your clients see your brand',       'White-labelling capabilities'],
              ['Know when clients read your docs',  'Powerful analytics dashboard'],
              ['Built for agencies',                'Designed for teams of all sizes'],
              ['Every doc. One hub. Your brand.',   'The all-in-one solution for your needs'],
            ].map(([say, dont], i) => (
              <div key={i} className={`grid grid-cols-2 py-3 rounded-lg ${i % 2 === 1 ? 'bg-[#f2f2f2]' : ''}`}>
                <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--ink)]">&ldquo;{say}&rdquo;</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] line-through decoration-[#e03e3e]/30">&ldquo;{dont}&rdquo;</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl p-5" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-playfair)] text-base italic text-[var(--ink)]">
              One-liner: <strong className="not-italic font-bold">&ldquo;Every doc. One hub. Your brand.&rdquo;</strong>
            </p>
          </div>
        </section>

        <Divider />

        {/* ── 06 LOGO ── */}
        <section id="logo" className="py-4">
          <Label>06 — Logo Guidelines</Label>
          <div className="grid md:grid-cols-2 gap-10 mb-10">
            <div>
              <H2>The Wordmark</H2>
              <Body className="mb-4">
                Set in Playfair Display, weight 700, −0.02em letter spacing. Always used at full legibility. The icon may be used alone only when the brand is already established in context.
              </Body>
              <Body>
                <span className="font-medium text-[var(--ink)]">Minimum sizes:</span> 80px wide for wordmark · 24px for icon. Never distort, recolour, or apply effects.
              </Body>
            </div>
            <div>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Clearspace</p>
              <Body>Minimum clearspace = cap-height of &ldquo;D&rdquo; on all four sides. No other element should enter this zone.</Body>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-8">
            <div className="rounded-xl p-8 flex flex-col gap-5" style={{ background: '#ffffff', outline: '1px solid #e5e5e5' }}>
              <div className="flex items-center gap-2 font-[family-name:var(--font-playfair)] text-xl font-bold text-[var(--ink)]">
                <img src="/docsiv-icon.png" alt="" width={28} height={28} />
                <span>Docsiv</span>
              </div>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.12em] uppercase text-[var(--muted)]">Primary — Ink on Paper</p>
            </div>
            <div className="rounded-xl p-8 flex flex-col gap-5" style={{ background: '#0a0a0a' }}>
              <div className="flex items-center gap-2 font-[family-name:var(--font-playfair)] text-xl font-bold text-white">
                <img src="/docsiv-icon.png" alt="" width={28} height={28} style={{ filter: 'invert(1)' }} />
                <span>Docsiv</span>
              </div>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.12em] uppercase text-white/40">Reversed — Paper on Ink</p>
            </div>
            <div className="rounded-xl p-8 flex flex-col gap-5" style={{ background: '#f2f2f2' }}>
              <div className="flex items-center gap-2 font-[family-name:var(--font-playfair)] text-xl font-bold text-[var(--ink)]">
                <img src="/docsiv-icon.png" alt="" width={28} height={28} />
                <span>Docsiv</span>
              </div>
              <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.12em] uppercase text-[var(--muted)]">On Warm Mid Surface</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            {[
              { ok: true,  rule: 'Use on white or off-white backgrounds' },
              { ok: true,  rule: 'Use reversed (white) on solid ink backgrounds' },
              { ok: false, rule: 'Never recolour, outline, or apply effects to the wordmark' },
              { ok: false, rule: 'Never place on photographic or patterned backgrounds' },
              { ok: false, rule: 'Never stretch or distort the proportions' },
              { ok: false, rule: 'Never use the wordmark at less than 80px wide' },
            ].map(({ ok, rule }) => (
              <div key={rule} className="flex items-start gap-2.5 rounded-lg px-4 py-3" style={{ background: ok ? '#ddedea' : '#fbe4e4' }}>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: ok ? '#0f7b6c' : '#e03e3e' }}>{ok ? '✓' : '✗'}</span>
                <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light" style={{ color: ok ? '#0f7b6c' : '#e03e3e' }}>{rule}</span>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 07 TECH ── */}
        <section id="tech" className="py-4">
          <Label>07 — Tech Stack & Libraries</Label>
          <H2>What powers Docsiv</H2>
          <Body className="mb-10 max-w-xl">
            Each document type is routed to the library best suited to its format, visual needs, and editing complexity.
          </Body>

          <div className="grid md:grid-cols-2 gap-3 mb-12">
            {libraries.map(l => (
              <a key={l.name} href={`https://${l.url}`} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl p-5 hover:opacity-80 transition-opacity" style={{ background: l.color }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-[family-name:var(--font-playfair)] text-sm font-bold" style={{ color: l.text }}>{l.name}</p>
                    <Chip color="rgba(0,0,0,0.08)" text={l.text}>{l.badge}</Chip>
                  </div>
                  <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light leading-relaxed mb-1" style={{ color: l.text }}>{l.desc}</p>
                  <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-mono" style={{ color: l.text }}>{l.url}</p>
                </div>
              </a>
            ))}
          </div>

          <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Document Type → Library Map</p>
          <div className="space-y-0">
            <div className="grid grid-cols-3 py-2">
              {['Document Type', 'Library', 'Rationale'].map(h => (
                <span key={h} className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium tracking-[0.12em] uppercase text-[var(--muted)]">{h}</span>
              ))}
            </div>
            <div className="h-px bg-[var(--warm-mid)]" />
            {docTypeMap.map((d, i) => (
              <div key={d.type} className={`grid grid-cols-3 py-3 rounded-lg ${i % 2 === 1 ? 'bg-[#f2f2f2]' : ''}`}>
                <span className="font-[family-name:var(--font-playfair)] text-sm font-bold text-[var(--ink)]">{d.type}</span>
                <span><Chip color={d.color} text={d.text}>{d.lib}</Chip></span>
                <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] leading-snug">{d.reason}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl p-4" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">Styling:</span> Tailwind CSS v4 (<code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">@import &quot;tailwindcss&quot;</code>, no config). Brand tokens via arbitrary values:{' '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">text-[var(--ink)]</code>. Rounded corners:{' '}
              <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">rounded-lg</code> / <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">rounded-xl</code>.
            </p>
          </div>
        </section>

        <Divider />

        {/* ── 08 FEATURES ── */}
        <section id="features" className="py-4">
          <Label>08 — Core Features</Label>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {coreFeatures.map(f => (
              <div key={f.n} className="rounded-xl p-5" style={{ background: f.color }}>
                <p className="font-[family-name:var(--font-playfair)] text-xs italic mb-2" style={{ color: f.text }}>{f.n}</p>
                <p className="font-[family-name:var(--font-playfair)] text-sm font-bold mb-1.5 leading-snug" style={{ color: f.text }}>{f.label}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-xs font-light leading-relaxed" style={{ color: f.text }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 09 INTEGRATIONS ── */}
        <section id="integrations" className="py-4">
          <Label>09 — Data Source Integrations</Label>
          <H2>Planned & active integrations</H2>
          <Body className="mb-8 max-w-xl">
            Powers data import, document generation, CRM connectivity, notifications, and branded email delivery.
          </Body>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {integrations.map(i => (
              <div key={i.name} className="rounded-xl px-4 py-3" style={{ background: i.color }}>
                <p className="font-[family-name:var(--font-playfair)] text-sm font-bold mb-0.5" style={{ color: i.text }}>{i.name}</p>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.65rem] font-medium uppercase tracking-[0.1em]" style={{ color: i.text }}>{i.cat}</p>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 10 DO'S & DON'TS ── */}
        <section id="rules" className="py-4">
          <Label>10 — Do&apos;s & Don&apos;ts</Label>
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[var(--ink)] mb-4">Do</p>
              <ul className="space-y-0">
                {[
                  'Use Playfair Display italic for emphasis — never bold for emphasis',
                  'Use rounded corners (rounded-lg / rounded-xl) consistently on all cards',
                  'Pair paper backgrounds with ink text at full contrast',
                  'Use uppercase + wide letter-spacing for all label/tag elements',
                  'Keep layouts flat — no drop shadows, no gradients',
                  'Left-align body copy for readability at all times',
                  'Ensure every layout is responsive: mobile first',
                  'Use Notion-tint backgrounds as content separators instead of borders',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 py-2.5">
                    <span className="text-[#0f7b6c] font-bold text-sm flex-shrink-0 mt-0.5">✓</span>
                    <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[var(--ink)] mb-4">Don&apos;t</p>
              <ul className="space-y-0">
                {[
                  'Never use gradients on any surface or element',
                  'Never add box-shadows to cards, modals, or components',
                  'Never place the Docsiv logo over a coloured background',
                  'Never distort or rotate the wordmark',
                  'Never use typefaces outside Playfair Display and DM Sans',
                  'Never use sharp square corners — rounded is the standard',
                  'Never use colour combinations that fail WCAG AA contrast',
                  'Never use borders where a tinted background can do the job',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 py-2.5">
                    <span className="text-[#e03e3e] font-bold text-sm flex-shrink-0 mt-0.5">✗</span>
                    <span className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── 12 COMPLETE BUILD ROADMAP ── */}
        <section id="roadmap" className="py-4">
          <Label>12 — Complete Build Roadmap for Docsiv</Label>
          <H2>Step-by-step build roadmap</H2>
          <Body className="mb-10 max-w-2xl">
            Phased plan from auth through MVP to full product: integrations, billing, and e-signatures.
          </Body>

          {/* Phase 1 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#ddebf1' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#0b6e99' }}>🔐 Phase 1 — Auth & Onboarding</p>
            <div className="space-y-6">
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0b6e99' }}>1. Auth Pages</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0b6e99' }}>
                  <li>Sign up (email + password, Google OAuth)</li>
                  <li>Sign in</li>
                  <li>Forgot password / reset password</li>
                  <li>Magic link option via Resend</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0b6e99' }}>2. Onboarding Flow (multi-step, one question per screen)</p>
                <ol className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1 list-decimal list-inside" style={{ color: '#0b6e99' }}>
                  <li>Welcome screen (&quot;Let&apos;s set up your Docsiv workspace&quot;)</li>
                  <li>Your name (first + last)</li>
                  <li>Agency name</li>
                  <li>Agency website (optional)</li>
                  <li>Theme Selction - Dark or light</li>
                  <li>Team size (solo / 2-5 / 6-20 / 20+)</li>
                  <li>What do you mainly send clients? (proposals / reports / contracts / all of the above — multi select)</li>
                  <li>How did you hear about us? (Reddit / LinkedIn / Google / Friend / Other)</li>
                  <li>Invite team members (email field, skip option)</li>
                  <li>Brand setup (upload logo, pick primary color, set agency display name)</li>
                  <li>All done screen (&quot;Your workspace is ready&quot;)</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#ddedea' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#0f7b6c' }}>🏠 Phase 2 — Core App Shell</p>
            <div className="space-y-6">
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0f7b6c' }}>3. Dashboard (Home)</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0f7b6c' }}>
                  <li>Recent documents</li>
                  <li>Quick create button</li>
                  <li>Stats strip (docs sent, opened, signed)</li>
                  <li>Client list preview</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0f7b6c' }}>4. Sidebar Navigation</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0f7b6c' }}>
                  <li>Logo + workspace name · Home · Documents · Clients · Templates · Settings · Help</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0f7b6c' }}>5. Settings Pages</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0f7b6c' }}>
                  <li>Profile settings (name, email, password)</li>
                  <li>Workspace settings (agency name, logo, domain)</li>
                  <li>Brand settings (colors, fonts — white label config)</li>
                  <li>Team management (invite, roles, remove)</li>
                  <li>Billing (Stripe integration)</li>
                  <li>Integrations page (connect GA, Meta Ads, HubSpot etc)</li>
                  <li>Notification preferences</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#eae4f2' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#6940a5' }}>👥 Phase 3 — Client Management</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#6940a5' }}>6. Clients Page</p>
            <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#6940a5' }}>
              <li>Client list view</li>
              <li>Add new client (name, email, logo, website)</li>
              <li>Client detail page (all docs sent to this client)</li>
              <li>Client portal preview (see what client sees)</li>
            </ul>
          </div>

          {/* Phase 4 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#fbf3db' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#dfab01' }}>📄 Phase 4 — Document Creation</p>
            <div className="space-y-6">
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#dfab01' }}>7. New Document Flow</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#dfab01' }}>
                  <li>Pick document type (proposal / report / sheet / contract / deck / sow / brief / document)</li>
                  <li>Pick creation method: AI generate, Start from template, Start blank</li>
                  <li>Select client · Name the document</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#dfab01' }}>8. Document Editors</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#dfab01' }}>
                  <li>Custom editor (Konva) — proposals, reports, case studies, strategy decks</li>
                  <li>Plate.js — SOWs, contracts, briefs, onboarding docs</li>
                  <li>Univer — sheets (spreadsheets, budgets, trackers)</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#dfab01' }}>9. Document Settings Panel</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#dfab01' }}>
                  <li>Document name · Assign to client · Expiry date (optional)</li>
                  <li>Require email to view · Require e-signature · Password protect (optional)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase 5 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#faebdd' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#d9730d' }}>📬 Phase 5 — Document Delivery</p>
            <div className="space-y-6">
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#d9730d' }}>10. Share & Send</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#d9730d' }}>
                  <li>Generate shareable link · Send via email (branded, via Resend) · Copy link · Embed option</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#d9730d' }}>11. Branded Client Portal</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#d9730d' }}>
                  <li>Public-facing portal at agency&apos;s custom domain</li>
                  <li>Client login (magic link via email)</li>
                  <li>All documents organized by client · Document viewer (clean, branded, no Docsiv branding)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase 6 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#ddedea' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#0f7b6c' }}>📊 Phase 6 — Analytics & Tracking</p>
            <div className="space-y-6">
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0f7b6c' }}>12. Document Analytics</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0f7b6c' }}>
                  <li>Opened / not opened status · Time spent · Pages/sections viewed · Last viewed timestamp</li>
                  <li>Notification when client opens (Slack + email)</li>
                </ul>
              </div>
              <div>
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: '#0f7b6c' }}>13. Dashboard Analytics</p>
                <ul className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1" style={{ color: '#0f7b6c' }}>
                  <li>Total docs sent · Open rate · Most viewed documents · Client engagement overview</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase 7–10 */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-playfair)] text-base font-bold text-[var(--ink)] mb-4">📝 Phase 7 — Templates</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] mb-4">14. Template Library: browse by type, save as template, agency templates, Docsiv starter templates.</p>
            <p className="font-[family-name:var(--font-playfair)] text-base font-bold text-[var(--ink)] mb-4">💳 Phase 8 — Billing & Plans</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] mb-4">15. Free / Pro / Agency tiers, Stripe checkout, upgrade-downgrade, invoice history.</p>
            <p className="font-[family-name:var(--font-playfair)] text-base font-bold text-[var(--ink)] mb-4">🔗 Phase 9 — Integrations</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)] mb-4">16. GA, Meta Ads, Google Drive, HubSpot, Stripe, Zapier, Slack/Teams, Resend/SendGrid (in priority order).</p>
            <p className="font-[family-name:var(--font-playfair)] text-base font-bold text-[var(--ink)] mb-2">✍️ Phase 10 — E-Signature</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)]">17. Signature fields, client signs via link, signed PDF, audit trail.</p>
          </div>

          {/* Build order summary */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#fbf3db' }}>
            <p className="font-[family-name:var(--font-playfair)] text-lg font-bold mb-4" style={{ color: '#dfab01' }}>🚀 Build Order Summary</p>
            <ol className="font-[family-name:var(--font-dm-sans)] text-sm font-light space-y-1.5 list-decimal list-inside" style={{ color: '#dfab01' }}>
              <li>Auth (sign up, sign in, reset)</li>
              <li>Onboarding flow (10 steps)</li>
              <li>App shell + sidebar</li>
              <li>Settings (workspace, brand, team)</li>
              <li>Client management</li>
              <li>New document flow + AI generation</li>
              <li>Plate.js editor (text docs — SOWs, briefs)</li>
              <li>Custom Konva editor (proposals, reports, case studies, decks)</li>
              <li>Univer (sheets)</li>
              <li>Share + branded portal</li>
              <li>Analytics + open tracking</li>
              <li>Templates</li>
              <li>Billing + Stripe</li>
              <li>Integrations (GA, Meta first)</li>
              <li>E-signatures</li>
            </ol>
            <p className="font-[family-name:var(--font-playfair)] text-sm italic mt-4" style={{ color: '#dfab01' }}>
              <strong className="not-italic font-bold">MVP:</strong> Auth → onboarding → shell → clients → one editor (Plate.js) → share link → analytics. Everything else layers on top.
            </p>
          </div>
        </section>

        <Divider />

        {/* ── ASSETS ── */}
        <section className="py-4">
          <Label>11 — Brand Assets & Contact</Label>
          <div className="grid md:grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Logo Package',      desc: 'SVG, PNG (1×, 2×, 3×), icon and reversed variants', c: '#ddedea', t: '#0f7b6c', badge: 'Available' },
              { label: 'Typefaces',         desc: 'Playfair Display & DM Sans via Google Fonts',        c: '#ddebf1', t: '#0b6e99', badge: 'Free' },
              { label: 'Colour Tokens',     desc: 'CSS custom properties in globals.css',               c: '#eae4f2', t: '#6940a5', badge: 'In codebase' },
              { label: 'Proposal Template', desc: 'Branded Google Docs template',                       c: '#f2f2f2', t: '#9b9a97', badge: 'Coming Soon' },
              { label: 'Figma Pitch Deck',  desc: 'Slide deck following brand guidelines',              c: '#f2f2f2', t: '#9b9a97', badge: 'Coming Soon' },
              { label: 'Social Templates',  desc: 'Frames for LinkedIn, Instagram, Twitter/X',          c: '#f2f2f2', t: '#9b9a97', badge: 'Coming Soon' },
            ].map(a => (
              <div key={a.label} className="rounded-xl p-4" style={{ background: a.c }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-[family-name:var(--font-playfair)] text-sm font-bold" style={{ color: a.t }}>{a.label}</p>
                  <Chip color="rgba(0,0,0,0.07)" text={a.t}>{a.badge}</Chip>
                </div>
                <p className="font-[family-name:var(--font-dm-sans)] text-xs font-light leading-snug" style={{ color: a.t }}>{a.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-5" style={{ background: '#f2f2f2' }}>
            <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5">Brand & Product Questions</p>
            <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light text-[var(--muted)]">
              Contact{' '}
              <a href="mailto:hello@docsiv.com" className="text-[var(--ink)] font-medium underline underline-offset-2 hover:text-[var(--muted)] transition-colors">
                hello@docsiv.com
              </a>
            </p>
          </div>
        </section>

      </main>

      <footer className="cs-bottom-bar">
        <span className="cs-bottom-bar-left">© 2026 Docsiv. All rights reserved.</span>
        <div className="cs-bottom-bar-right">
          <a href="mailto:hello@docsiv.com">hello@docsiv.com</a>
          <a href="https://www.instagram.com/docsiv" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://linkedin.com/company/docsiv/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </footer>
    </>
  );
}
