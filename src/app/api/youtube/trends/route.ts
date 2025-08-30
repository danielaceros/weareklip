import { NextResponse } from "next/server";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 evento GA4
import { adminAuth } from "@/lib/firebase-admin";

const API_KEY = process.env.YOUTUBE_API_KEY as string;
const MAX_RESULTS = 50;

interface SearchItem {
  id: { videoId: string };
}

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { high: { url: string } };
    description: string;
    publishedAt: string;
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
  };
}

// Mapa de país a idioma para relevanceLanguage
const langMap: Record<string, string> = {
  ES: "es",
  MX: "es",
  AR: "es",
  US: "en",
  FR: "fr",
};

export async function GET(request: Request) {
  const simulate = process.env.SIMULATE === "true";
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "ES";
  const range = searchParams.get("range") || "week";
  const query = searchParams.get("query") || "";

  // 1️⃣ Autenticación
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authHeader.slice("Bearer ".length);
  try {
    // Verificación del token de usuario
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid; // Usuario autenticado
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2️⃣ Validación de parámetros de búsqueda
  if (!['today', 'week', 'month', 'year'].includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }

  if (!['ES', 'MX', 'AR', 'US', 'FR'].includes(country)) {
    return NextResponse.json({ error: 'Invalid country' }, { status: 400 });
  }

  // 🔁 SIMULACIÓN
  if (simulate) {
    console.log("🟢 Simulación YouTube Shorts activa");
    const fakeShorts = Array.from({ length: 5 }).map((_, i) => ({
      rank: i + 1,
      id: `fake_id_${i + 1}`,
      title: `Short de prueba ${i + 1}`,
      channel: `Canal Demo ${i + 1}`,
      views: `${(1000 * (i + 1)).toLocaleString()}`,
      url: `https://www.youtube.com/watch?v=fake_id_${i + 1}`,
      thumbnail: "https://via.placeholder.com/480x360.png?text=Thumbnail",
      description: `Descripción simulada del short ${i + 1}`,
      publishedAt: new Date().toISOString(),
      simulated: true,
    }));
    await gaServerEvent("youtube_shorts_simulated", { country, range, query, count: fakeShorts.length }); // 👈 evento
    return NextResponse.json(fakeShorts);
  }

  // 🔁 REAL
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY" },
      { status: 500 }
    );
  }

  // Calcular fecha mínima según rango
  let publishedAfter = "";
  const now = new Date();
  switch (range) {
    case "today":
      publishedAfter = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "week":
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "month":
      publishedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "year":
      publishedAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      break;
    default:
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    const searchQuery = query ? `${query} #shorts` : "#shorts";
    const relevanceLanguage = langMap[country] || "es";

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&maxResults=${MAX_RESULTS}&q=${encodeURIComponent(
      searchQuery
    )}&type=video&regionCode=${country}&relevanceLanguage=${relevanceLanguage}&order=viewCount&publishedAfter=${publishedAfter}&key=${API_KEY}`;

    const searchRes = await fetch(searchUrl);
    const searchData: { items?: SearchItem[] } = await searchRes.json();

    if (!searchData.items?.length) {
      return NextResponse.json({ error: "No shorts found" }, { status: 404 });
    }

    const ids = searchData.items.map((item) => item.id.videoId).join(",");

    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${API_KEY}`;
    const videosRes = await fetch(videosUrl);
    const videosData: { items: VideoItem[] } = await videosRes.json();

    const shorts = videosData.items.filter((video) => {
      const match = video.contentDetails.duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
      const mins = parseInt(match?.[1] || "0");
      const secs = parseInt(match?.[2] || "0");
      return mins * 60 + secs <= 60;
    });

    shorts.sort(
      (a, b) =>
        parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount)
    );

    const formatted = shorts.map((video, index) => ({
      rank: index + 1,
      id: video.id,
      title: video.snippet.title,
      channel: video.snippet.channelTitle,
      views: video.statistics.viewCount,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail: video.snippet.thumbnails.high.url,
      description: video.snippet.description,
      publishedAt: video.snippet.publishedAt,
    }));

    await gaServerEvent("youtube_shorts_fetched", { country, range, query, count: formatted.length }); // 👈 evento
    return NextResponse.json(formatted);
  } catch (error: unknown) {
    console.error(error);
    await gaServerEvent("youtube_shorts_failed", { country, range, query, error: error instanceof Error ? error.message : String(error) }); // 👈 evento
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
