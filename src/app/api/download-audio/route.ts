// src/app/api/download-audio/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Limpia un nombre de archivo y evita caracteres raros */
function sanitizeFilename(name?: string) {
  const base = (name || "audio").trim();
  const cleaned = base.replace(/[^\w\-\. ]+/g, "") || "audio";
  return cleaned;
}

/** Extensión desde path */
function extFromPath(path: string) {
  const m = path.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/i);
  return m ? m[1] : "";
}

/** Extensión desde content-type (fallback) */
function extFromCT(ct: string | null) {
  if (!ct) return "";
  const v = ct.toLowerCase();
  if (v.includes("wav")) return "wav";
  if (v.includes("ogg")) return "ogg";
  if (v.includes("x-m4a") || v.includes("aac")) return "m4a";
  if (v.includes("mpeg") || v.includes("mp3")) return "mp3";
  return "";
}

/** Lista blanca de hosts permitidos (seguridad básica) */
function allowedHosts(): Set<string> {
  const defaults = [
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
    "fake.elevenlabs.local", // host "fake" de desarrollo
  ];

  const extra = (process.env.DOWNLOAD_ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Si hay ELEVENLABS_FAKE_ORIGIN, añadimos su host (p. ej. 127.0.0.1)
  const fakeOrigin = process.env.ELEVENLABS_FAKE_ORIGIN;
  if (fakeOrigin) {
    try {
      const h = new URL(fakeOrigin).hostname;
      if (h) defaults.push(h);
    } catch {
      // ignore
    }
  }

  return new Set([...defaults, ...extra]);
}

export async function GET(req: NextRequest) {
  try {
    const uParam = req.nextUrl.searchParams.get("u");
    const filenameParam = req.nextUrl.searchParams.get("filename");

    if (!uParam) {
      return NextResponse.json({ error: "Missing 'u' query param" }, { status: 400 });
    }

    // 1) Parseamos la URL de origen
    let src: URL;
    try {
      src = new URL(uParam);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!/^https?:$/.test(src.protocol)) {
      return NextResponse.json({ error: "Protocol not allowed" }, { status: 400 });
    }

    // 2) Reescritura para dev: fake.elevenlabs.local -> ELEVENLABS_FAKE_ORIGIN
    if (src.hostname === "fake.elevenlabs.local") {
      const fallback = process.env.ELEVENLABS_FAKE_ORIGIN || "";
      if (!fallback) {
        return NextResponse.json(
          {
            error:
              "fake.elevenlabs.local no resuelve. Define ELEVENLABS_FAKE_ORIGIN en .env.local (p.ej. http://127.0.0.1:8787)",
          },
          { status: 502 }
        );
      }
      const base = new URL(fallback); // ej: http://127.0.0.1:8787
      // Conservamos path + query originales
      src = new URL(src.pathname + src.search, base);
    }

    // 3) Seguridad: sólo hosts permitidos
    const allowed = allowedHosts();
    if (!allowed.has(src.hostname)) {
      return NextResponse.json(
        { error: `Host not allowed: ${src.hostname}` },
        { status: 403 }
      );
    }

    // 4) Si es Firebase/GCS, aseguramos bytes crudos
    if (/firebasestorage|storage\.googleapis/.test(src.hostname)) {
      if (!src.searchParams.get("alt")) src.searchParams.set("alt", "media");
    }

    // 5) Hacemos fetch al upstream desde el servidor (evita CORS/DNS del cliente)
    const upstream = await fetch(src.toString(), { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    // 6) Determinar nombre final y content-type
    const lastSeg = src.pathname.split("/").pop() || "audio";
    const baseNameFromURL = lastSeg.replace(/\.[^.]+$/, "");
    const providedBase = sanitizeFilename(filenameParam || baseNameFromURL || "audio");

    const ct = upstream.headers.get("content-type") || "audio/mpeg";
    const fromPath = extFromPath(src.pathname);
    const fromCT = extFromCT(ct);
    const ext = fromPath || fromCT || "mp3";
    const finalFilename = `${providedBase}.${ext}`;

    // 7) Responder como adjunto (fuerza descarga con nombre bonito)
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        // no ponemos Content-Length para no forzar buffer en el edge
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
      },
    });
  } catch (e) {
    console.error("[download-audio] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
