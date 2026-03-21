import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";

const ANALYSIS_PROMPT = `You are a layout analysis expert. Analyze the uploaded layout/design image and return a structured JSON description.

Return ONLY a JSON object with this exact structure:
{
  "layout_type": "report" | "presentation" | "spreadsheet" | "proposal" | "doc" | "contract",
  "sections": [
    {
      "type": "header" | "content" | "footer" | "sidebar" | "title" | "image" | "table" | "chart",
      "position": "top" | "bottom" | "left" | "right" | "center",
      "height_percent": number (0-100),
      "width_percent": number (0-100),
      "style": {
        "background_color": "hex color",
        "text_color": "hex color",
        "border_radius": number,
        "padding": number
      },
      "content": "brief description of what's in this section"
    }
  ],
  "color_scheme": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color"
  },
  "typography": {
    "heading_font": "font family name",
    "body_font": "font family name",
    "heading_size": "e.g., 24px",
    "body_size": "e.g., 16px"
  },
  "suggested_base_type": "doc" | "sheet" | "presentation" | "contract"
}

Guidelines:
- layout_type: Choose based on the overall purpose (report for multi-page docs, presentation for slides, etc.)
- sections: Identify all major visual sections (header, main content, footer, sidebars, images, tables, charts)
- color_scheme: Extract the main colors visible in the layout
- typography: Identify the font styles used (or suggest appropriate ones)
- suggested_base_type: Recommend the document type that best fits this layout

If the image is NOT a layout/design (e.g., a photo, screenshot, or unrelated image), return:
{
  "layout_type": "doc",
  "sections": [],
  "color_scheme": { "primary": "#000000", "secondary": "#666666" },
  "typography": { "heading_font": "Inter", "body_font": "Inter" },
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
              mimeType,
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
