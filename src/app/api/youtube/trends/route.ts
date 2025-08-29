// src/app/api/youtube/trends/route.ts
import { NextResponse } from "next/server";
import { gaServerEvent } from "@/lib/ga-server";

const API_KEY = process.env.YOUTUBE_API_KEY as string;
const MAX_RESULTS = 50;

interface SearchItem { id: { videoId: string } }
interface VideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { high: { url: string } };
    description: string;
    publishedAt: string;
  };
  contentDetails: { duration: string };
  statistics: { viewCount: string };
}

const langMap: Record<string, string> = { ES: "es", MX: "es", AR: "es", US: "en", FR: "fr" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "ES";
  const range   = searchParams.get("range")   || "week";
  const query   = searchParams.get("query")   || "";

  // --- SIMULACIÓN (solo si NO hay API key o SIMULATE=true) ---
  const simulate = process.env.SIMULATE === "true" || !API_KEY;
  if (simulate) {
    const SAMPLE: Array<{ id: string; title: string; channel: string; views: string }> = [
      { id: "aqz-KE-bpKQ", title: "Big Buck Bunny (4K)", channel: "Blender", views: "134000000" },
      { id: "M7lc1UVf-VE", title: "YouTube IFrame Player API Demo", channel: "Google for Developers", views: "1200000" },
      { id: "ysz5S6PUM-U", title: "WebGL Fluid Simulation", channel: "PavelDoGreat", views: "5000000" },
      { id: "ScMzIvxBSi4", title: "Relaxing Music", channel: "Relax Music", views: "220000000" },
      { id: "hY7m5jjJ9mM", title: "Keyboard Cat", channel: "Keyboard Cat", views: "60000000" },
      { id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", channel: "Rick Astley", views: "1200000000" },
    ];
    const base = Array.from(query || "klip").reduce((a, c) => a + c.charCodeAt(0), 0) % SAMPLE.length;
    const out = Array.from({ length: 6 }).map((_, i) => {
      const m = SAMPLE[(base + i) % SAMPLE.length];
      return {
        rank: i + 1,
        id: m.id,
        title: m.title,
        channel: m.channel,
        views: m.views,
        url: `https://www.youtube.com/watch?v=${m.id}`,
        thumbnail: `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`,
        description: `Resultado simulado (${query || "sin query"})`,
        publishedAt: new Date().toISOString(),
        simulated: true,
      };
    });
    await gaServerEvent("youtube_shorts_simulated", { country, range, query, count: out.length });
    return NextResponse.json(out);
  }

  // --- REAL ---
  // ventana temporal por rango
  let publishedAfter = "";
  const now = new Date();
  switch (range) {
    case "today": publishedAfter = new Date(now.getTime() - 1   * 24 * 60 * 60 * 1000).toISOString(); break;
    case "week":  publishedAfter = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000).toISOString(); break;
    case "month": publishedAfter = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000).toISOString(); break;
    case "year":  publishedAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(); break;
    default:      publishedAfter = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    const relevanceLanguage = langMap[country] || "es";

    // 🔎 Buscar vídeos cortos y embebibles R E A L E S relacionados con la query
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=id` +
      `&maxResults=${MAX_RESULTS}` +
      `&q=${encodeURIComponent(query)}` +                     // usamos tu búsqueda literal
      `&type=video` +
      `&videoDuration=short` +                               // <= 4 min (YouTube); luego filtramos a <= 60s
      `&videoEmbeddable=true` +                              // aseguramos que el embed funcione
      `&order=viewCount` +
      `&regionCode=${country}` +
      `&relevanceLanguage=${relevanceLanguage}` +
      `&publishedAfter=${publishedAfter}` +
      `&key=${API_KEY}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`YouTube search ${searchRes.status} ${await searchRes.text()}`);
    const searchData: { items?: SearchItem[] } = await searchRes.json();
    if (!searchData.items?.length) return NextResponse.json([], { status: 200 });

    const ids = searchData.items.map((i) => i.id.videoId).join(",");
    const videosUrl =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=snippet,contentDetails,statistics` +
      `&id=${ids}` +
      `&key=${API_KEY}`;
    const videosRes = await fetch(videosUrl);
    if (!videosRes.ok) throw new Error(`YouTube videos ${videosRes.status} ${await videosRes.text()}`);
    const videosData: { items: VideoItem[] } = await videosRes.json();

    // ⏱️ Ajuste extra: quedarnos en <= 60s (shorts reales)
    const shorts = videosData.items.filter((v) => {
      const m = v.contentDetails.duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
      const mins = parseInt(m?.[1] || "0", 10);
      const secs = parseInt(m?.[2] || "0", 10);
      return mins * 60 + secs <= 60;
    });

    shorts.sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount));

    const formatted = shorts.map((v, i) => ({
      rank: i + 1,
      id: v.id,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      views: v.statistics.viewCount,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail: v.snippet.thumbnails.high.url,
      description: v.snippet.description,
      publishedAt: v.snippet.publishedAt,
    }));

    await gaServerEvent("youtube_shorts_fetched", { country, range, query, count: formatted.length });
    return NextResponse.json(formatted);
  } catch (e) {
    console.error(e);
    await gaServerEvent("youtube_shorts_failed", { country, range, query, error: String(e) });
    return NextResponse.json([], { status: 200 });
  }
}
