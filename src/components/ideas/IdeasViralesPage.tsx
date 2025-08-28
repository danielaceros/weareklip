"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { serverTimestamp } from "firebase/firestore";
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
  const [displayCount, setDisplayCount] = useState(5);
  const [favorites, setFavorites] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  // Detectar login y cargar favoritos
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await loadFavorites(loggedUser.uid);
      } else {
        setFavorites([]);
      }
    });
    return () => unsub();
  }, []);

  const loadFavorites = async (uid: string) => {
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Usuario no autenticado");

      const res = await fetch(`/api/firebase/users/${uid}/ideas`, {
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
    setLoading(true);
    const loadingToast = toast.loading("Buscando vídeos virales...");
    try {
      const res = await fetch(
        `/api/youtube/trends?country=${country}&range=${range}&query=${encodeURIComponent(
          query
        )}`
      );
      const data = await res.json();
      setVideos(data);
      setDisplayCount(5);
      toast.success("Vídeos cargados correctamente", { id: loadingToast });
    } catch (err) {
      console.error("Error fetching shorts:", err);
      toast.error("Error al cargar los vídeos", { id: loadingToast });
    }
    setLoading(false);
  };

  // Filtrar
  const filteredVideos = videos.filter(
    (video) =>
      video.title.toLowerCase().includes(query.toLowerCase()) ||
      video.description?.toLowerCase().includes(query.toLowerCase())
  );

  // Scroll infinito
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setDisplayCount((prev) => Math.min(prev + 5, filteredVideos.length));
    }
  }, [filteredVideos.length]);

  useEffect(() => {
    const currentRef = listRef.current;
    if (currentRef) {
      currentRef.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (currentRef) {
        currentRef.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll]);

  // Añadir o quitar favoritos
  const toggleFavorite = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para guardar favoritos");
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const exists = favorites.some((fav) => fav.id === video.id);

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

      toast.success(exists ? "Eliminado de favoritos" : "Añadido a favoritos");
      await loadFavorites(user.uid);
    } catch (err) {
      console.error("Error en toggleFavorite:", err);
      toast.error("No se pudo actualizar favoritos");
    }
  };


  // Replicar vídeo
  const replicateVideo = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para replicar vídeos");
      return;
    }

    const replicateToast = toast.loading("Replicando guion...");
    try {
      // 🔹 Obtener transcripción desde tu API
      const res = await fetch(`/api/youtube/transcript?id=${video.id}`);
      const data = await res.json();

      if (!data.transcript) {
        toast.error("No se encontró transcripción", { id: replicateToast });
        return;
      }

      // 🔹 Preparar body para el nuevo guion
      const newScript = {
        description: `Guion replicado de ${video.title}`,
        platform: "youtube",
        language: "es",
        script: data.transcript,
        createdAt: new Date(), // tu backend lo guarda como Timestamp
        fuente: video.url,
        isAI: false,
        videoTitle: video.title,
        videoDescription: video.description,
        videoChannel: video.channel,
        videoPublishedAt: video.publishedAt,
        videoViews: video.views,
        videoThumbnail: video.thumbnail,
      };

      // 🔹 Guardar en /scripts via API segura
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
      await saveRes.json();

      toast.success("Guion replicado y guardado ✅", { id: replicateToast });
      router.push("/dashboard/script");
    } catch (err) {
      console.error("Error replicando vídeo:", err);
      toast.error("Error al replicar vídeo", { id: replicateToast });
    }
  };


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

      <IdeasViralesFavorites
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
