import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";

const ANALYSIS_PROMPT = `You are a layout analysis expert. Analyze the uploaded layout/design image and return a precise, structured JSON description that can be used to REPRODUCE the design programmatically.

Return ONLY a JSON object with this exact structure:
{
  "layout_type": "report" | "presentation" | "spreadsheet" | "proposal" | "doc" | "contract",
  "page_dimensions": {
    "aspect_ratio": "portrait" | "landscape" | "square",
    "columns": number (1 for single column, 2+ for multi-column layouts)
  },
  "sections": [
    {
      "type": "header" | "content" | "footer" | "sidebar" | "title" | "hero" | "image" | "table" | "chart" | "nav" | "cta" | "stats" | "testimonial" | "logo",
      "bounds": {
        "x_percent": number (0-100, left edge position as % of page width),
        "y_percent": number (0-100, top edge position as % of page height),
        "width_percent": number (0-100, width as % of page width),
        "height_percent": number (0-100, height as % of page height)
      },
      "z_index": number (0 = bottom, higher = on top; use for overlapping elements),
      "style": {
        "background_color": "hex color or 'transparent'",
        "background_gradient": "CSS gradient string or null (e.g., 'linear-gradient(135deg, #667eea, #764ba2)')",
        "text_color": "hex color",
        "font_family": "font family name",
        "font_size_px": number,
        "font_weight": "normal" | "bold" | "light" | "semibold",
        "text_align": "left" | "center" | "right",
        "letter_spacing_px": number or null,
        "line_height": number or null (e.g., 1.5),
        "border_width_px": number or 0,
        "border_color": "hex color or null",
        "border_radius_px": number or 0,
        "padding_px": number or 0,
        "opacity": number (0-1, default 1)
      },
      "content": "exact text visible in this section, or descriptive placeholder if image/chart",
      "content_type": "text" | "image" | "icon" | "chart" | "table" | "mixed",
      "children": [
        {
          "type": "text" | "image" | "icon" | "button" | "divider" | "badge",
          "content": "text content or description",
          "style": { ... same style fields as parent, only include overrides ... }
        }
      ]
    }
  ],
  "color_scheme": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color",
    "text_secondary": "hex color"
  },
  "typography": {
    "heading_font": "font family name",
    "body_font": "font family name",
    "heading_size_px": number,
    "subheading_size_px": number,
    "body_size_px": number,
    "caption_size_px": number,
    "heading_weight": "normal" | "bold" | "light" | "semibold",
    "body_weight": "normal" | "light"
  },
  "spacing": {
    "section_gap_px": number (vertical gap between major sections),
    "margin_px": number (page margin),
    "content_padding_px": number (inner padding of content areas)
  },
  "suggested_base_type": "doc" | "sheet" | "presentation" | "contract"
}

Guidelines:
- **Precise positioning**: Measure x/y/width/height as percentages of the total page. Be as accurate as possible — these values will be used to place elements programmatically.
- **All visible sections**: Capture EVERY distinct visual region — headers, footers, sidebars, content blocks, image placeholders, stat cards, CTAs, navigation bars, logos, decorative elements.
- **Overlapping elements**: Use z_index to indicate layering order (e.g., text overlaying a background image).
- **Multi-column layouts**: If content is in columns, create separate sections for each column with correct x_percent and width_percent.
- **Colors**: Extract exact hex colors from the image. Identify gradients where present.
- **Typography**: Identify font families (or suggest the closest match from: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Playfair Display, Merriweather, Bebas Neue, Oswald, Raleway).
- **Content**: Capture actual text visible in the image. For images/charts, describe what's shown (e.g., "bar chart showing monthly revenue", "team photo").
- **Children**: For sections with mixed content (e.g., a card with heading + description + button), list child elements.

If the image is NOT a layout/design (e.g., a photo, screenshot, or unrelated image), return:
{
  "layout_type": "doc",
  "page_dimensions": { "aspect_ratio": "portrait", "columns": 1 },
  "sections": [],
  "color_scheme": { "primary": "#000000", "secondary": "#666666", "accent": "#3b82f6", "background": "#ffffff", "text": "#000000", "text_secondary": "#666666" },
  "typography": { "heading_font": "Inter", "body_font": "Inter", "heading_size_px": 24, "subheading_size_px": 18, "body_size_px": 14, "caption_size_px": 12, "heading_weight": "bold", "body_weight": "normal" },
  "spacing": { "section_gap_px": 16, "margin_px": 24, "content_padding_px": 16 },
  "suggested_base_type": "doc",
  "not_a_layout": true
}`;

function computeImageHash(dataUrl: string): string {
  // Simple hash for cache lookup - use the first 64 chars of base64 data
  const base64Match = dataUrl.match(/base64,(.+)$/);
  if (base64Match) {
    return base64Match[1].slice(0, 64);
  }
  // Fallback: hash the whole string
  let hash = 0;
  for (let i = 0; i < Math.min(dataUrl.length, 1000); i++) {
    const char = dataUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Google Generative AI API key" },
      { status: 500 }
    );
  }

  let body: { image_data_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image_data_url } = body;
  if (!image_data_url || !image_data_url.startsWith("data:")) {
    return NextResponse.json(
      { error: "Missing or invalid image_data_url" },
      { status: 400 }
    );
  }

  // Check cache first
  const imageHash = computeImageHash(image_data_url);
  const supabase = await createClient();

  try {
    const { data: cached, error: cacheError } = await supabase
      .from("layout_analysis_cache")
      .select("*")
      .eq("image_hash", imageHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!cacheError && cached) {
      return NextResponse.json({
        success: true,
        cached: true,
        analysis: {
          layout_type: cached.layout_type,
          sections: cached.sections,
          color_scheme: cached.color_scheme,
          typography: cached.typography,
          suggested_base_type: cached.suggested_base_type,
        },
      });
    }
  } catch {
    // Continue to analysis if cache lookup fails
  }

  // Extract base64 from data URL
  const commaIdx = image_data_url.indexOf(",");
  if (commaIdx < 0) {
    return NextResponse.json(
      { error: "Invalid data URL format" },
      { status: 400 }
    );
  }

  const base64 = image_data_url.slice(commaIdx + 1);
  const header = image_data_url.slice(0, commaIdx);
  const mimeMatch = header.match(/data:(.+?);/);
  const mimeType = mimeMatch?.[1] ?? "image/png";

  // Call Gemini Vision API
  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const result = await generateText({
      model: google("gemini-2.0-flash-exp"),
      maxOutputTokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            {
              type: "image",
              image: base64,
              mediaType: mimeType,
            },
          ],
        },
      ],
    });

    const text = result.text?.trim() ?? "";

    // Extract JSON from response
    let jsonStr = text;
    if (text.includes("```json")) {
      jsonStr = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      jsonStr = text.split("```")[1].split("```")[0].trim();
    }

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse layout analysis", raw_response: text },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!analysis.layout_type || !analysis.suggested_base_type) {
      return NextResponse.json(
        { error: "Invalid analysis result", analysis },
        { status: 500 }
      );
    }

    // Cache the result
    try {
      await supabase.from("layout_analysis_cache").insert({
        image_hash: imageHash,
        layout_type: analysis.layout_type,
        sections: analysis.sections ?? [],
        color_scheme: analysis.color_scheme ?? null,
        typography: analysis.typography ?? null,
        suggested_base_type: analysis.suggested_base_type,
        raw_analysis: analysis,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
    } catch (cacheErr) {
      console.warn("[analyze-layout] Failed to cache result:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      cached: false,
      analysis: {
        layout_type: analysis.layout_type,
        sections: analysis.sections ?? [],
        color_scheme: analysis.color_scheme ?? null,
        typography: analysis.typography ?? null,
        suggested_base_type: analysis.suggested_base_type,
      },
    });
  } catch (err) {
    console.error("[analyze-layout] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
