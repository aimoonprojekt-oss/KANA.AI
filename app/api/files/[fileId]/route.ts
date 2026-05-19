import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ message: "Keine File-ID" }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beta = (anthropic as any).beta;

    // Datei-Metadaten abrufen (für Filename + MIME-Type)
    const fileMeta = await beta.files.retrieve(fileId);
    const filename = fileMeta?.filename ?? fileId;

    // Datei-Inhalt herunterladen
    const content = await beta.files.download(fileId);

    // Content kann ein Response-Objekt, Buffer oder ReadableStream sein
    let body: BodyInit;
    let contentType = "application/octet-stream";

    if (content instanceof Response) {
      body = content.body!;
      contentType = content.headers.get("content-type") ?? contentType;
    } else if (content instanceof ArrayBuffer || Buffer.isBuffer(content)) {
      body = content as ArrayBuffer;
    } else if (typeof content === "object" && content !== null && "arrayBuffer" in content) {
      body = await (content as Blob).arrayBuffer();
      contentType = (content as Blob).type || contentType;
    } else {
      body = String(content);
    }

    // MIME-Type anhand Dateiendung ergänzen wenn nötig
    if (contentType === "application/octet-stream") {
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pdf:  "application/pdf",
        txt:  "text/plain",
        csv:  "text/csv",
        json: "application/json",
        html: "text/html",
        png:  "image/png",
        jpg:  "image/jpeg",
        jpeg: "image/jpeg",
      };
      if (ext && mimeMap[ext]) contentType = mimeMap[ext];
    }

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Files API Fehler:", error);
    const msg = error instanceof Error ? error.message : "Download fehlgeschlagen";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
