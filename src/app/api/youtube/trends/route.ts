import { NextResponse } from "next/server";

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
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "ES";
  const range = searchParams.get("range") || "week";
  const query = searchParams.get("query") || "";

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

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
