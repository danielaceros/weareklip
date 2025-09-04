// src/app/dashboard/ideas/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useT } from "@/lib/i18n";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { IdeasViralesHeader } from "@/components/ideas/IdeasViralesHeader";
import { IdeasViralesSearch } from "@/components/ideas/IdeasViralesSearch";
import {
  IdeasViralesList,
  ShortVideo,
} from "@/components/ideas/IdeasViralesList";
import { IdeasViralesFavorites } from "@/components/ideas/IdeasViralesFavorites";

export default function IdeasViralesPage() {
  const t = useT();
  const router = useRouter();
  const [country, setCountry] = useState("ES");
  const [range, setRange] = useState("week");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [favorites, setFavorites] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Mostrar “sin resultados” solo después de una búsqueda válida
  const [hasSearched, setHasSearched] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // Detectar login y cargar favoritos
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await loadFavorites(loggedUser);
      } else {
        setFavorites([]);
      }
    });
    return () => unsub();
  }, []);

  const loadFavorites = async (loggedUser: User) => {
    try {
      const idToken = await loggedUser.getIdToken();

      const res = await fetch(`/api/firebase/users/${loggedUser.uid}/ideas`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      const favs = data.map((d: any) => d as ShortVideo);
      setFavorites(favs);
    } catch (err) {
      console.error("Error cargando favoritos:", err);
      toast.error("Error cargando favoritos");
    }
  };

  // Buscar vídeos virales
  const fetchVideos = async () => {
    if (!query.trim()) {
      toast.error("Escribe un nicho antes de buscar");
      return;
    }

    const userToken = user ? await user.getIdToken() : null;
    if (!userToken) {
      toast.error("Debes iniciar sesión para buscar vídeos");
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const loadingToast = toast.loading("Buscando vídeos virales...");

    try {
      const res = await fetch(
        `/api/youtube/trends?country=${country}&range=${range}&query=${encodeURIComponent(
          query
        )}`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      const data = await res.json();

      // Defensivo si la API no devuelve array
      const normalized: ShortVideo[] = (Array.isArray(data) ? data : []).map(
        (d: any) => ({
          ...d,
          views: Number(d.views) || 0,
        })
      );

      setVideos(normalized);

      // ✅ Si hay resultados, mostramos success; si no, ningún toast (solo mensaje abajo)
      if (normalized.length > 0) {
        toast.success("Vídeos cargados correctamente", { id: loadingToast });
      } else {
        toast.dismiss(loadingToast);
      }
    } catch (err) {
      console.error("Error fetching shorts:", err);
      toast.error("Error al cargar los vídeos", { id: loadingToast });
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

  // Añadir o quitar favoritos
  const toggleFavorite = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para guardar favoritos");
      return;
    }

    const exists = favorites.some((fav) => fav.id === video.id);

    // Optimistic UI
    setFavorites((prev) =>
      exists ? prev.filter((f) => f.id !== video.id) : [...prev, video]
    );

    try {
      const idToken = await user.getIdToken();
      const url = `/api/firebase/users/${user.uid}/ideas/${video.id}`;
      const options: RequestInit = {
        method: exists ? "DELETE" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: exists ? undefined : JSON.stringify(video),
      };

      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (err) {
      console.error("Error en toggleFavorite:", err);
      toast.error("No se pudo actualizar favoritos");
      // revertir cambio si falla
      setFavorites((prev) =>
        exists ? [...prev, video] : prev.filter((f) => f.id !== video.id)
      );
    }
  };

  // Replicar vídeo
  const replicateVideo = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para replicar vídeos");
      return;
    }

    try {
      const res = await fetch(`/api/youtube/transcript?id=${video.id}`);
      const data = await res.json();

      if (!data.transcript) {
        toast.error("No se encontró transcripción");
        return;
      }

      const newScript = {
        id: `temp-${video.id}`,
        description: `Guion replicado de ${video.title}`,
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
      toast.error("Error al replicar vídeo");
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
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onReplicate={replicateVideo}
        viewOnYoutubeText={t("viralIdeasPage.viewOnYoutube")}
      />

      {/* Empty states bajo la lista */}
      {showEmptyFromSearch && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay vídeos en tendencia para{" "}
          <span className="font-medium">“{query}”</span> con los filtros
          actuales. Prueba otro término, idioma o intervalo.
        </div>
      )}

      {showEmptyFromFilter && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay coincidencias con el filtro actual.
        </div>
      )}

      <IdeasViralesFavorites
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
