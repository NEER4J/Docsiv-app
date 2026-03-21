/**
 * Shared content generation prompt snippets used by both the main AI tools
 * and the editor AI routes. Centralises format documentation so both
 * surfaces produce consistent, high-quality output.
 */

// ── Plate / Slate node format ────────────────────────────────────────────────

export const PLATE_NODE_FORMAT_GUIDE = `
## Plate / Slate node format

Generate content as a JSON array of Slate block nodes. Every block MUST have
"type" (string) and "children" (array). Inline text leaves have "text" (string)
and optional marks.

### Block types
| type           | Description                    | Notes |
|----------------|--------------------------------|-------|
| p              | Paragraph                      | Default block |
| h1, h2, h3     | Heading levels 1-3            | Use for document structure |
| blockquote     | Block quote                    | |
| code_block     | Code block                     | children contain code_line nodes |
| code_line      | Line inside code_block         | |
| hr             | Horizontal rule                | children: [{ text: "" }] |
| img            | Image block                    | url, alt, width fields |
| table          | Table container                | children: tr nodes |
| tr             | Table row                      | children: td/th nodes |
| th             | Table header cell              | children: text leaves |
| td             | Table data cell                | children: text leaves |
| ul             | Unordered list                 | children: li nodes |
| ol             | Ordered list                   | children: li nodes |
| li             | List item                      | children: lic nodes |
| lic            | List item content              | children: text leaves |
| callout        | Callout box                    | variant: "info" | "warning" | "success" | "error" |
| toggle         | Collapsible toggle             | |
| column_group   | Multi-column layout container  | children: column nodes |
| column         | Column inside column_group     | width prop (e.g. "50%") |

### Text marks (applied to text leaves)
| mark           | Example |
|----------------|---------|
| bold           | { "text": "bold", "bold": true } |
| italic         | { "text": "italic", "italic": true } |
| underline      | { "text": "underlined", "underline": true } |
| strikethrough  | { "text": "struck", "strikethrough": true } |
| code           | { "text": "inline code", "code": true } |
| color          | { "text": "colored", "color": "#ef4444" } |
| backgroundColor | { "text": "highlighted", "backgroundColor": "#fef08a" } |
| fontSize       | { "text": "big", "fontSize": "24px" } |

### Examples

Simple document:
\`\`\`json
[
  { "type": "h1", "children": [{ "text": "Project Proposal" }] },
  { "type": "p", "children": [{ "text": "This proposal outlines..." }] },
  { "type": "h2", "children": [{ "text": "Scope of Work" }] },
  { "type": "ul", "children": [
    { "type": "li", "children": [{ "type": "lic", "children": [{ "text": "Design phase", "bold": true }, { "text": " — wireframes and mockups" }] }] },
    { "type": "li", "children": [{ "type": "lic", "children": [{ "text": "Development phase", "bold": true }, { "text": " — frontend and backend" }] }] }
  ]},
  { "type": "h2", "children": [{ "text": "Pricing" }] },
  { "type": "table", "children": [
    { "type": "tr", "children": [
      { "type": "th", "children": [{ "text": "Service" }] },
      { "type": "th", "children": [{ "text": "Price" }] }
    ]},
    { "type": "tr", "children": [
      { "type": "td", "children": [{ "text": "Design" }] },
      { "type": "td", "children": [{ "text": "$5,000" }] }
    ]}
  ]}
]
\`\`\`
`.trim();

// ── Konva shape format ──────────────────────────────────────────────────────

export const KONVA_SHAPE_FORMAT_GUIDE = `
## Konva shape format

Generate shapes as a JSON array of shape objects. Each shape MUST have "id" (string)
and "type" (string). All coordinates are in pixels.

### Shape types
| type            | Required props                     | Notes |
|-----------------|------------------------------------|-------|
| Rect            | x, y, width, height               | fill, stroke, cornerRadius |
| Text            | x, y, text                        | fontSize, fontFamily, fontStyle, fill, align, width |
| Circle          | x, y, radius                      | fill, stroke |
| Ellipse         | x, y, radiusX, radiusY            | fill, stroke |
| Line            | points (flat array [x1,y1,x2,y2]) | stroke, strokeWidth, closed |
| Arrow           | points (flat array)               | stroke, strokeWidth, pointerLength |
| Image           | x, y, width, height, src          | Image URL or data URL |
| Star            | x, y, numPoints, innerRadius, outerRadius | fill |
| RegularPolygon  | x, y, sides, radius               | fill, rotation |

### Common properties
- fill: string (hex color or "transparent")
- stroke: string (hex color)
- strokeWidth: number
- opacity: number (0-1)
- rotation: number (degrees)
- cornerRadius: number (for Rect)
- fontSize: number (for Text)
- fontFamily: string (for Text)
- fontStyle: "normal" | "bold" | "italic" | "bold italic" (for Text)
- align: "left" | "center" | "right" (for Text)
- verticalAlign: "top" | "middle" | "bottom" (for Text)

### Available fonts
Sans-serif: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Source Sans Pro, Nunito, Raleway
Serif: Playfair Display, Merriweather, Lora, PT Serif, Noto Serif
Display: Bebas Neue, Oswald, Anton

### Default page sizes
- Report page: 794 × 1123 px (A4 portrait)
- Presentation slide: 960 × 540 px (16:9 landscape)

### Design guidelines
- Use consistent margins (40-60px from edges)
- Maintain visual hierarchy with font size (titles 28-36px, headings 20-24px, body 14-16px)
- Use the color scheme consistently (primary for headings, secondary for accents, text color for body)
- Never overlap text elements — ensure proper spacing
- Add whitespace between sections (20-40px gaps)
`.trim();

// ── Univer cell format ──────────────────────────────────────────────────────

export const UNIVER_CELL_FORMAT_GUIDE = `
## Univer spreadsheet cell format

Cell data is structured as a nested object: { [rowIndex]: { [colIndex]: cellObject } }
Row and column indices are 0-based strings (e.g., "0", "1", "2").

### Cell object properties
| prop | Type    | Description |
|------|---------|-------------|
| v    | string/number/boolean | Cell value (displayed text or number) |
| f    | string  | Formula (e.g., "=SUM(A1:A10)") |
| t    | number  | Type: 1=string, 2=number, 3=boolean |
| s    | string/object | Style ID or inline style object |

### Inline style object properties
| prop           | Description |
|----------------|-------------|
| ff             | Font family (e.g., "Inter") |
| fs             | Font size in pt (e.g., 11) |
| bl             | Bold: 1=bold, 0=normal |
| it             | Italic: 1=italic, 0=normal |
| ul.s           | Underline: 1=underlined |
| cl             | Font color (hex, e.g., "#000000") |
| bg             | Background color (hex) |
| ht             | Horizontal align: 0=default, 1=left, 2=center, 3=right |
| vt             | Vertical align: 0=default, 1=top, 2=middle, 3=bottom |
| tb             | Text wrap: 1=overflow, 2=wrap, 3=clip |

### Example
\`\`\`json
{
  "0": {
    "0": { "v": "Month", "s": { "bl": 1, "bg": "#f1f5f9" } },
    "1": { "v": "Revenue", "s": { "bl": 1, "bg": "#f1f5f9" } },
    "2": { "v": "Expenses", "s": { "bl": 1, "bg": "#f1f5f9" } }
  },
  "1": {
    "0": { "v": "January" },
    "1": { "v": 50000, "t": 2 },
    "2": { "v": 32000, "t": 2 }
  },
  "2": {
    "0": { "v": "February" },
    "1": { "v": 55000, "t": 2 },
    "2": { "v": 34000, "t": 2 }
  },
  "3": {
    "0": { "v": "Total", "s": { "bl": 1 } },
    "1": { "f": "=SUM(B2:B3)", "t": 2 },
    "2": { "f": "=SUM(C2:C3)", "t": 2 }
  }
}
\`\`\`
`.trim();

// ── Content generation quality guidelines ──────────────────────────────────

export const CONTENT_QUALITY_GUIDELINES = `
## Content generation quality

When generating document content:
1. **Be specific**: Use concrete details from the user's request (names, numbers, deliverables). Never use generic placeholder text like "Lorem ipsum" or "[Insert here]".
2. **Be complete**: Generate full, professional-quality content. Include multiple sections, proper headings, and thorough detail.
3. **Match the document type**:
   - Proposals: Executive summary, scope, timeline, pricing, next steps
   - Reports: Key metrics, analysis, charts/tables, recommendations
   - Contracts: Parties, scope, terms, payment, signatures
   - Presentations: Title slide, agenda, content slides, summary
   - Spreadsheets: Headers, data rows, formulas, totals
4. **Use formatting**: Bold for emphasis, tables for structured data, lists for enumerations, headings for navigation.
5. **Professional tone**: Business-appropriate language. Adjust formality based on document type.
`.trim();
