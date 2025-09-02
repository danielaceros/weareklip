"use client";

import { useEffect, useState, useRef } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { Card } from "@/components/ui/card";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { DialogClose } from "@/components/ui/dialog"; // ✅ para cerrar el modal desde dentro

type AudioItem = { id: string; audioUrl: string; name?: string };
type VideoItem = { id: string; url: string; name?: string };

const PAGE_SIZE = 1;
const MAX_SEC = 60; // ⏱️ límite duro

// Helpers para leer duración desde URL remota
const getAudioDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => resolve(a.duration || 0);
    a.onerror = () =>
      reject(new Error("No se pudo leer la duración del audio"));
  });

const getVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () =>
      reject(new Error("No se pudo leer la duración del vídeo"));
  });

interface Props {
  onCreated?: () => void;
  onCancel?: () => void;
}

export default function LipsyncCreatePage({ onCreated, onCancel }: Props) {
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
  const [showCheckout, setShowCheckout] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  // 🔘 botón de cierre oculto (DialogClose)
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // ⏱️ estados de duración de lo seleccionado (cache simple)
  const [audioSec, setAudioSec] = useState<number | null>(null);
  const [videoSec, setVideoSec] = useState<number | null>(null);

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
      if (current && current.id !== selectedVideoId)
        setSelectedVideoId(current.id);
    }
  }, [videoPage, videos, selectedVideoId]);

  useEffect(() => {
    if (audios.length > 0) {
      const current = audios[audioPage * PAGE_SIZE];
      if (current && current.id !== selectedAudioId)
        setSelectedAudioId(current.id);
    }
  }, [audioPage, audios, selectedAudioId]);

  // ⏱️ medir duración cuando cambia el audio seleccionado
  useEffect(() => {
    const a = audios.find((x) => x.id === selectedAudioId);
    if (!a?.audioUrl) {
      setAudioSec(null);
      return;
    }
    let cancelled = false;
    getAudioDurationFromUrl(a.audioUrl)
      .then((sec) => {
        if (!cancelled) {
          setAudioSec(sec || 0);
          if (sec > MAX_SEC) {
            toast.error(
              `⏱️ El audio dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAudioSec(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAudioId, audios]);

  // ⏱️ medir duración cuando cambia el vídeo seleccionado
  useEffect(() => {
    const v = videos.find((x) => x.id === selectedVideoId);
    if (!v?.url) {
      setVideoSec(null);
      return;
    }
    let cancelled = false;
    getVideoDurationFromUrl(v.url)
      .then((sec) => {
        if (!cancelled) {
          setVideoSec(sec || 0);
          if (sec > MAX_SEC) {
            toast.error(
              `⏱️ El vídeo dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setVideoSec(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVideoId, videos]);

  async function loadMedia(uid: string) {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();

      const resAudios = await fetch(`/api/firebase/users/${uid}/audios`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resAudios.ok) throw new Error("Error cargando audios");
      const audiosJson: any[] = await resAudios.json();

      const resClones = await fetch(`/api/firebase/users/${uid}/clones`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resClones.ok) throw new Error("Error cargando vídeos");
      const clonesJson: any[] = await resClones.json();

      setAudios(
        audiosJson.map((a) => ({
          id: a.id,
          audioUrl: a.audioUrl ?? "",
          name: a.name || a.id,
        }))
      );
      setVideos(
        clonesJson.map((v) => ({
          id: v.id,
          url: v.url ?? "",
          name: v.titulo || v.id,
        }))
      );
    } catch (err) {
      console.error("loadMedia error:", err);
      toast.error("Error cargando audios/vídeos");
    }
  }

  async function handleGenerate() {
    flushSync(() => setProcessing(true));

    const ok = await ensureSubscribed({ feature: "lipsync" });
    if (!ok) {
      setProcessing(false);
      setShowCheckout(true);
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

    // ⏱️ Validación dura de duración (audio + vídeo)
    try {
      const aSec =
        audioSec ??
        (await getAudioDurationFromUrl(audio.audioUrl).catch(() => 0));
      const vSec =
        videoSec ?? (await getVideoDurationFromUrl(video.url).catch(() => 0));

      if (!aSec) {
        toast.error("No se pudo leer la duración del audio.");
        setProcessing(false);
        return;
      }
      if (!vSec) {
        toast.error("No se pudo leer la duración del vídeo.");
        setProcessing(false);
        return;
      }
      if (aSec > MAX_SEC) {
        toast.error(
          `⏱️ El audio dura ${Math.round(aSec)}s y el máximo es ${MAX_SEC}s.`
        );
        setProcessing(false);
        return;
      }
      if (vSec > MAX_SEC) {
        toast.error(
          `⏱️ El vídeo dura ${Math.round(vSec)}s y el máximo es ${MAX_SEC}s.`
        );
        setProcessing(false);
        return;
      }
    } catch {
      toast.error("No se pudo validar la duración de los medios.");
      setProcessing(false);
      return;
    }

    toast.info(`Generando vídeo: "${title}"`);

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

      // ✅ Notifica al padre y CIERRA el modal (forzado)
      onCreated?.();
      // cierra el <Dialog> del padre usando Radix
      closeRef.current?.click();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear el lipsync"
      );
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  }

  const isLoading = processing || loading;
  const buttonText = processing
    ? "Procesando..."
    : loading
    ? "Generando..."
    : "Generar video";

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

  const paginatedVideos = videos.slice(
    videoPage * PAGE_SIZE,
    (videoPage + 1) * PAGE_SIZE
  );
  const paginatedAudios = audios.slice(
    audioPage * PAGE_SIZE,
    (audioPage + 1) * PAGE_SIZE
  );

  return (
    <>
      <div className="w-full max-w-6xl mx-auto rounded-2xl space-y-8 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">Videos clonados</h2>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        {/* Botón de cierre oculto para Radix/Dialog */}
        <DialogClose asChild>
          <button ref={closeRef} className="hidden" aria-hidden="true" />
        </DialogClose>

        {/* Carrusel de videos */}
        <div className="relative">
          <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg justify-center">
            {paginatedVideos.map((v) => (
              <Card
                key={v.id}
                className={`flex-shrink-0 w-32 h-48 sm:w-40 sm:h-60 rounded-lg cursor-pointer border-2 ${
                  selectedVideoId === v.id
                    ? "border-primary"
                    : "border-transparent"
                }`}
                onClick={() => setSelectedVideoId(v.id)}
              >
                <video
                  src={v.url}
                  className="w-full h-full object-cover rounded-md"
                  muted
                />
              </Card>
            ))}
          </div>
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
                setVideoPage((p) =>
                  (p + 1) * PAGE_SIZE < videos.length ? p + 1 : p
                )
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
                  selectedAudioId === a.id
                    ? "border-primary"
                    : "border-transparent"
                }`}
                onClick={() => a.audioUrl && setSelectedAudioId(a.id)}
              >
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-xs sm:text-sm truncate">
                    {a.name}
                  </span>
                  {a.audioUrl ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay(a.id);
                        }}
                        className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border hover:bg-muted"
                      >
                        {playing === a.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <audio
                        ref={(el) => {
                          audioRefs.current[a.id] = el;
                        }}
                        src={a.audioUrl || undefined}
                        onEnded={() => setPlaying(null)}
                        onPause={() =>
                          setPlaying((prev) => (prev === a.id ? null : prev))
                        }
                      />
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Sin audio
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
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
                setAudioPage((p) =>
                  (p + 1) * PAGE_SIZE < audios.length ? p + 1 : p
                )
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

      {/* Modal checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar audios."
      />
    </>
  );
}
