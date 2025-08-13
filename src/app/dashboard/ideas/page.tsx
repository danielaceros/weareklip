"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Heart, Youtube, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { serverTimestamp } from "firebase/firestore";
import Image from "next/image";

type ShortVideo = {
  rank: number;
  id: string;
  title: string;
  channel: string;
  views: string;
  url: string;
  thumbnail: string;
  description: string;
  publishedAt: string;
};

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
    const favSnap = await getDocs(collection(db, `users/${uid}/ideas`));
    const favs = favSnap.docs.map((doc) => doc.data() as ShortVideo);
    setFavorites(favs);
  };

  const fetchVideos = async () => {
    if (!query.trim()) {
      toast.error("Escribe un nicho antes de buscar");
      return;
    }
    setLoading(true);
    const loadingToast = toast.loading("Buscando vídeos virales...");
    try {
      const res = await fetch(
        `/api/youtube/trends?country=${country}&range=${range}&query=${encodeURIComponent(query)}`
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

  const filteredVideos = videos.filter(
    (video) =>
      video.title.toLowerCase().includes(query.toLowerCase()) ||
      video.description?.toLowerCase().includes(query.toLowerCase())
  );

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

  const toggleFavorite = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para guardar favoritos");
      return;
    }
    const favRef = doc(collection(db, `users/${user.uid}/ideas`), video.id);
    const exists = favorites.some((fav) => fav.id === video.id);
    if (exists) {
      await deleteDoc(favRef);
      toast.success("Eliminado de favoritos");
    } else {
      await setDoc(favRef, video);
      toast.success("Añadido a favoritos");
    }
    await loadFavorites(user.uid);
  };

  const replicateVideo = async (video: ShortVideo) => {
    if (!user) {
      toast.error("Debes iniciar sesión para replicar vídeos");
      return;
    }
    const replicateToast = toast.loading("Replicando guion...");
    try {
      const res = await fetch(`/api/youtube/transcript?id=${video.id}`);
      const data = await res.json();

      if (!data.transcript) {
        toast.error("No se encontró transcripción", { id: replicateToast });
        return;
      }

      const guionRef = doc(collection(db, `users/${user.uid}/guiones`));
      await setDoc(guionRef, {
        description: `Guion replicado de ${video.title}`,
        platform: "youtube",
        language: "es",
        script: data.transcript,
        createdAt: serverTimestamp(),
        scriptId: guionRef.id,
        fuente: video.url,
        isAI: false,
        videoTitle: video.title,
        videoDescription: video.description,
        videoChannel: video.channel,
        videoPublishedAt: video.publishedAt,
        videoViews: video.views,
        videoThumbnail: video.thumbnail,
      });

      toast.success("Guion replicado y guardado ✅", { id: replicateToast });
      router.push("/dashboard/script");
    } catch (err) {
      console.error(err);
      toast.error("Error al replicar vídeo", { id: replicateToast });
    }
  };

  return (
    <div className="min-h-[85vh] max-w-6xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">{t("viralIdeasPage.title")}</h1>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="border border-border rounded-lg px-3 py-1 bg-background"
        >
          <option value="ES">🇪🇸 España</option>
          <option value="US">🇺🇸 USA</option>
          <option value="MX">🇲🇽 México</option>
          <option value="AR">🇦🇷 Argentina</option>
          <option value="FR">🇫🇷 Francia</option>
        </select>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="border border-border rounded-lg px-3 py-1 bg-background"
        >
          <option value="today">📅 Hoy</option>
          <option value="week">🗓 Última semana</option>
          <option value="month">📆 Último mes</option>
          <option value="year">📊 Último año</option>
        </select>
      </div>

      {/* Buscador */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nicho (ej: negocios, fitness...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border border-border rounded-lg px-4 py-2 bg-background"
        />
        <button
          onClick={fetchVideos}
          disabled={!query.trim()}
          className={`px-4 py-2 rounded-lg ${
            query.trim()
              ? "bg-primary text-white hover:bg-primary/80"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Buscar
        </button>
      </div>

      {/* Lista */}
      <div
        ref={listRef}
        className="bg-card border border-border rounded-2xl shadow-lg p-6 max-h-[500px] overflow-y-auto"
      >
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <ul className="space-y-4">
            {filteredVideos.slice(0, displayCount).map((video, idx) => (
              <li key={video.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                <span className="text-lg font-bold w-8 text-center">{idx + 1}</span>
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  width={112}
                  height={64}
                  className="object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold line-clamp-2">{video.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {video.channel} • {Number(video.views).toLocaleString()} views
                  </p>
                </div>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1 flex items-center gap-1"
                >
                  <Youtube size={16} /> {t("viralIdeasPage.viewOnYoutube")}
                </a>
                <button
                  onClick={() => toggleFavorite(video)}
                  className={`ml-2 ${
                    favorites.some((fav) => fav.id === video.id) ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  <Heart
                    fill={favorites.some((fav) => fav.id === video.id) ? "currentColor" : "none"}
                    size={20}
                  />
                </button>
                <button
                  onClick={() => replicateVideo(video)}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1"
                >
                  Replicar vídeo
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Favoritos */}
      <div className="bg-muted border border-border rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Heart className="text-red-500" size={20} /> Favoritos
        </h2>
        {favorites.length === 0 ? (
          <p className="text-muted-foreground">No tienes vídeos guardados</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((video) => (
              <li key={video.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  width={80}
                  height={48}
                  className="object-cover rounded-md"
                />
                <div className="flex-1">
                  <h4 className="font-medium line-clamp-1">{video.title}</h4>
                  <p className="text-xs text-muted-foreground">{video.channel}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-500 hover:underline text-sm"
                  >
                    Ver
                  </a>
                  <button
                    onClick={() => toggleFavorite(video)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
