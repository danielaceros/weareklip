// src/app/dashboard/ideas/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useT } from "@/lib/i18n";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { IdeasViralesHeader } from "@/components/ideas/IdeasViralesHeader";
import { IdeasViralesSearch } from "@/components/ideas/IdeasViralesSearch";
import { IdeasViralesList, ShortVideo } from "@/components/ideas/IdeasViralesList";
import { IdeasViralesFavorites } from "@/components/ideas/IdeasViralesFavorites";
import { useFavorites } from "@/hooks/useFavorites";

export default function IdeasViralesPage() {
  const t = useT();
  const router = useRouter();
  const [country, setCountry] = useState("ES");
  const [range, setRange] = useState("week");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Mostrar “sin resultados” solo después de una búsqueda válida
  const [hasSearched, setHasSearched] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // Detectar login (la carga de favoritos la hace el hook)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
    });
    return () => unsub();
  }, []);

  // Favoritos desde el hook (persistencia local + nube)
  const {
    favorites,
    loading: favoritesLoading, // por si quieres mostrar skeleton/spinner
    toggleFavorite,
  } = useFavorites({ user, db });

  // Buscar vídeos virales
  const fetchVideos = async () => {
    if (!query.trim()) {
      toast.error(t("viralIdeasPage.toasts.enterNiche"));
      return;
    }

    const userToken = user ? await user.getIdToken() : null;
    if (!userToken) {
      toast.error(t("viralIdeasPage.toasts.mustLoginSearch"));
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const loadingToast = toast.loading(t("viralIdeasPage.toasts.loading"));

    try {
      const res = await fetch(
        `/api/youtube/trends?country=${country}&range=${range}&query=${encodeURIComponent(
          query
        )}`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      const data = await res.json();

      // Defensivo si la API no devuelve array
      const normalized: ShortVideo[] = (Array.isArray(data) ? data : []).map(
        (d: any) => ({ ...d, views: Number(d.views) || 0 })
      );

      setVideos(normalized);

      if (normalized.length > 0) {
        toast.success(t("viralIdeasPage.toasts.loaded"), { id: loadingToast });
      } else {
        toast.dismiss(loadingToast);
      }
    } catch (err) {
      console.error("Error fetching shorts:", err);
      toast.error(t("viralIdeasPage.toasts.loadError"), { id: loadingToast });
      setVideos([]); // para que aparezca el estado vacío
    } finally {
      setLoading(false);
    }
  };

  // Filtrar
  const filteredVideos =
    query.trim() === ""
      ? videos
      : videos.filter(
          (video) =>
            video.title.toLowerCase().includes(query.toLowerCase()) ||
            video.description?.toLowerCase().includes(query.toLowerCase())
        );

  // Replicar vídeo (igual que antes)
  const replicateVideo = async (video: ShortVideo) => {
    if (!user) {
      toast.error(t("viralIdeasPage.toasts.mustLoginReplicate"));
      return;
    }

    try {
      const res = await fetch(`/api/youtube/transcript?id=${video.id}`);
      const data = await res.json();

      if (!data.transcript) {
        toast.error(t("viralIdeasPage.toasts.noTranscript"));
        return;
      }

      const newScript = {
        id: `temp-${video.id}`,
        description: t("viralIdeasPage.replicatedScriptDescription", {
          title: video.title,
        }),
        platform: "youtube",
        script: data.transcript,
        isAI: false,
        createdAt: new Date(),
        videoTitle: video.title,
        videoThumbnail: video.thumbnail,
        fuente: video.url,
        videoDescription: video.description,
        videoChannel: video.channel,
        videoPublishedAt: video.publishedAt,
        videoViews: video.views,
      };

      const idToken = await user.getIdToken();
      const saveRes = await fetch(`/api/firebase/users/${user.uid}/scripts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(newScript),
      });

      if (!saveRes.ok) throw new Error(`Error ${saveRes.status}`);
      router.push("/dashboard/script");
    } catch (err) {
      console.error("Error replicando vídeo:", err);
      toast.error(t("viralIdeasPage.toasts.replicateError"));
    }
  };

  // Mensajes de “no hay resultados” bajo la lista
  const showEmptyFromSearch =
    hasSearched && !loading && videos.length === 0 && query.trim() !== "";
  const showEmptyFromFilter =
    !loading && videos.length > 0 && filteredVideos.length === 0;

  return (
    <div className="min-h-[85vh] max-w-6xl mx-auto py-8 space-y-8">
      <IdeasViralesHeader
        country={country}
        setCountry={setCountry}
        range={range}
        setRange={setRange}
        title={t("viralIdeasPage.title")}
      />

      <IdeasViralesSearch
        query={query}
        setQuery={setQuery}
        onSearch={fetchVideos}
      />

      <IdeasViralesList
        listRef={listRef}
        loading={loading}
        filteredVideos={filteredVideos}
        favorites={favorites as ShortVideo[]}
        onToggleFavorite={(v) => {
          if (!user) {
            toast.error(t("viralIdeasPage.toasts.mustLoginFavorite"));
            return;
          }
          toggleFavorite(v);
        }}
        onReplicate={replicateVideo}
        viewOnYoutubeText={t("viralIdeasPage.viewOnYoutube")}
      />

      {/* Empty states bajo la lista */}
      {showEmptyFromSearch && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("viralIdeasPage.empty.noResultsForFilters", { query })}
        </div>
      )}

      {showEmptyFromFilter && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("viralIdeasPage.empty.noMatchesForFilter")}
        </div>
      )}

      <IdeasViralesFavorites
        favorites={favorites as ShortVideo[]}
        onToggleFavorite={(v) => {
          if (!user) {
            toast.error(t("viralIdeasPage.toasts.mustLoginFavorite"));
            return;
          }
          toggleFavorite(v);
        }}
      />
    </div>
  );
}
