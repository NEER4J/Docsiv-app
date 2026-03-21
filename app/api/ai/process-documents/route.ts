import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type InputFile = {
  id: string;
  name: string;
  mimeType?: string;
  dataUrl: string;
};

function decodeBase64FromDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } | null {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:(.*?);base64$/i);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  try {
    return { bytes: Buffer.from(base64, "base64"), mimeType };
  } catch {
    return null;
  }
}

function sanitizeText(input: string): string {
  return input.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, 12000);
}

function isTextLike(mimeType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json")
  );
}

export async function POST(req: NextRequest) {
  let body: { files?: InputFile[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) {
    return NextResponse.json({ processed: [] });
  }

  const processed = files.map((f) => {
    if (!f?.id || !f?.name || typeof f?.dataUrl !== "string") {
      return { id: f?.id ?? "", status: "error", error: "Invalid file payload" } as const;
    }
    const decoded = decodeBase64FromDataUrl(f.dataUrl);
    if (!decoded) {
      return { id: f.id, status: "error", error: "Invalid data URL" } as const;
    }
    const mimeType = f.mimeType || decoded.mimeType;
    const fileName = f.name;

    if (isTextLike(mimeType, fileName)) {
      const text = sanitizeText(decoded.bytes.toString("utf-8"));
      return {
        id: f.id,
        status: "done",
        mimeType,
        extractedText: text,
        summary: text ? `Extracted ${Math.min(text.length, 12000)} chars` : "No extractable text",
      } as const;
    }

    if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      // Lightweight PDF handling for now: keep as binary ref and metadata.
      return {
        id: f.id,
        status: "done",
        mimeType: "application/pdf",
        extractedText: "",
        summary: "PDF attached. Text extraction will be inferred by model context.",
      } as const;
    }

    return {
      id: f.id,
      status: "done",
      mimeType,
      extractedText: "",
      summary: "Binary attachment ready",
    } as const;
  });

  return NextResponse.json({ processed });
}

