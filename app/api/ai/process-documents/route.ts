import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseFileToText } from "@/lib/ai/file-parser";

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

  const processed = await Promise.all(
    files.map(async (f) => {
      if (!f?.id || !f?.name || typeof f?.dataUrl !== "string") {
        return { id: f?.id ?? "", status: "error" as const, error: "Invalid file payload" };
      }
      const decoded = decodeBase64FromDataUrl(f.dataUrl);
      if (!decoded) {
        return { id: f.id, status: "error" as const, error: "Invalid data URL" };
      }
      const mimeType = f.mimeType || decoded.mimeType;

      try {
        const result = await parseFileToText(decoded.bytes, mimeType, f.name);
        return {
          id: f.id,
          status: "done" as const,
          mimeType,
          extractedText: result.extractedText,
          canSendNatively: result.canSendNatively,
          summary: result.canSendNatively
            ? `${mimeType.startsWith("image/") ? "Image" : "PDF"} attached — will be sent directly to model.`
            : result.extractedText
              ? `Extracted ${result.extractedText.length} chars from ${f.name}`
              : "Binary attachment ready",
        };
      } catch {
        return { id: f.id, status: "error" as const, error: "Failed to parse file" };
      }
    }),
  );

  return NextResponse.json({ processed });
}

