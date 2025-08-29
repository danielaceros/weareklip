"use client";

import { useEffect, useState, useRef } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { Card } from "@/components/ui/card";

type AudioItem = { id: string; audioUrl: string; name?: string };
type VideoItem = { id: string; url: string; name?: string };

const PAGE_SIZE = 1;

interface Props {
  onClose?: () => void; // 👈 opcional, si está en modal
}

export default function LipsyncCreatePage({ onClose }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [title, setTitle] = useState("");

  const [videoPage, setVideoPage] = useState(0);
  const [audioPage, setAudioPage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [playing, setPlaying] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  const router = useRouter();
  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await loadMedia(currentUser.uid);
    });
  }, []);

  useEffect(() => {
    if (videos.length > 0) {
      const current = videos[videoPage * PAGE_SIZE];
      if (current && current.id !== selectedVideoId) {
        setSelectedVideoId(current.id);
      }
    }
  }, [videoPage, videos, selectedVideoId]);

  useEffect(() => {
    if (audios.length > 0) {
      const current = audios[audioPage * PAGE_SIZE];
      if (current && current.id !== selectedAudioId) {
        setSelectedAudioId(current.id);
      }
    }
  }, [audioPage, audios, selectedAudioId]);

  async function loadMedia(uid: string) {
    try {
      const audiosSnap = await getDocs(collection(db, "users", uid, "audios"));
      const a: AudioItem[] = audiosSnap.docs.map((doc) => {
        const data = doc.data() as Partial<AudioItem> & { audioUrl?: string };
        return {
          id: doc.id,
          audioUrl: data.audioUrl ?? "",
          name: data.name || doc.id,
        };
      });

      const videosSnap = await getDocs(collection(db, "users", uid, "clonacion"));
      const v: VideoItem[] = videosSnap.docs.map((doc) => {
        const data = doc.data() as Partial<VideoItem> & { url?: string; titulo?: string };
        return {
          id: doc.id,
          url: data.url ?? "",
          name: data.titulo || doc.id,
        };
      });

      setAudios(a);
      setVideos(v);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando audios/vídeos");
    }
  }

  async function handleGenerate() {
    flushSync(() => setProcessing(true));

    const ok = await ensureSubscribed({ feature: "lipsync" });
    if (!ok) {
      toast.error("Necesitas suscripción para generar Lipsync.");
      setProcessing(false);
      return;
    }

    if (!user) {
      toast.error("Debes iniciar sesión.");
      setProcessing(false);
      return;
    }

    const audio = audios.find((a) => a.id === selectedAudioId);
    if (!audio?.audioUrl) {
      toast.error("Debes seleccionar un audio válido.");
      setProcessing(false);
      return;
    }

    const video = videos.find((v) => v.id === selectedVideoId);
    if (!video?.url) {
      toast.error("Debes seleccionar un vídeo válido.");
      setProcessing(false);
      return;
    }

    if (!title.trim()) {
      toast.error("Debes escribir un título para el vídeo.");
      setProcessing(false);
      return;
    }

    toast.info(`Generando vídeo: "${title}" con audio "${audio.name}" y vídeo "${video.name}"`);

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/sync/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioUrl: audio.audioUrl,
          videoUrl: video.url,
          title,
        }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Error creando vídeo");

      toast.success("✅ Vídeo en proceso. Te avisaremos cuando esté listo.");
      onClose?.();
      router.push("/dashboard/video");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo crear el lipsync");
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  }

  const isLoading = processing || loading;
  const buttonText = processing ? "Procesando..." : loading ? "Generando..." : "Generar video";

  const togglePlay = (id: string) => {
    const current = audioRefs.current[id];
    if (!current) return;

    if (playing === id) {
      current.pause();
      setPlaying(null);
    } else {
      Object.entries(audioRefs.current).forEach(([key, el]) => {
        if (key !== id) el?.pause();
      });
      current.play().catch(() => {});
      setPlaying(id);
    }
  };

  const paginatedVideos = videos.slice(videoPage * PAGE_SIZE, (videoPage + 1) * PAGE_SIZE);
  const paginatedAudios = audios.slice(audioPage * PAGE_SIZE, (audioPage + 1) * PAGE_SIZE);

  return (
    <div className="w-full max-w-6xl mx-auto rounded-2xl space-y-8 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold">Videos clonados</h2>

      {/* Carrusel de videos */}
      <div className="relative">
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg justify-center">
          {paginatedVideos.map((v) => (
            <Card
              key={v.id}
              className={`flex-shrink-0 w-32 h-48 sm:w-40 sm:h-60 rounded-lg cursor-pointer border-2 ${
                selectedVideoId === v.id ? "border-primary" : "border-transparent"
              }`}
              onClick={() => setSelectedVideoId(v.id)}
            >
              <video src={v.url} className="w-full h-full object-cover rounded-md" muted />
            </Card>
          ))}
        </div>
        {/* Botones navegación video */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <Button
            size="icon"
            variant="ghost"
            className="bg-background/70 sm:bg-transparent"
            onClick={() => setVideoPage((p) => Math.max(0, p - 1))}
            disabled={videoPage === 0}
          >
            <ChevronLeft />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Button
            size="icon"
            variant="ghost"
            className="bg-background/70 sm:bg-transparent"
            onClick={() =>
              setVideoPage((p) => ((p + 1) * PAGE_SIZE < videos.length ? p + 1 : p))
            }
            disabled={(videoPage + 1) * PAGE_SIZE >= videos.length}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Carrusel de audios */}
      <div className="relative">
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg justify-center">
          {paginatedAudios.map((a) => (
            <Card
              key={a.id}
              className={`flex-shrink-0 w-36 sm:w-48 p-3 rounded-lg cursor-pointer border-2 ${
                selectedAudioId === a.id ? "border-primary" : "border-transparent"
              }`}
              onClick={() => a.audioUrl && setSelectedAudioId(a.id)}
            >
              <div className="flex flex-col gap-2">
                <span className="font-medium text-xs sm:text-sm truncate">{a.name}</span>
                {a.audioUrl ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay(a.id);
                      }}
                      className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border hover:bg-muted"
                    >
                      {playing === a.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <audio
                      ref={(el) => {
                        audioRefs.current[a.id] = el;
                      }}
                      src={a.audioUrl || undefined}
                      onEnded={() => setPlaying(null)}
                      onPause={() => setPlaying((prev) => (prev === a.id ? null : prev))}
                    />
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Sin audio</div>
                )}
              </div>
            </Card>
          ))}
        </div>
        {/* Botones navegación audio */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <Button
            size="icon"
            variant="ghost"
            className="bg-background/70 sm:bg-transparent"
            onClick={() => setAudioPage((p) => Math.max(0, p - 1))}
            disabled={audioPage === 0}
          >
            <ChevronLeft />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Button
            size="icon"
            variant="ghost"
            className="bg-background/70 sm:bg-transparent"
            onClick={() =>
              setAudioPage((p) => ((p + 1) * PAGE_SIZE < audios.length ? p + 1 : p))
            }
            disabled={(audioPage + 1) * PAGE_SIZE >= audios.length}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del video"
          className="flex-1 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-border bg-background text-sm sm:text-base"
        />
        <Button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full sm:w-auto min-w-[150px] sm:min-w-[180px]"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
