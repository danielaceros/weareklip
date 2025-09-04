// src/components/audio/AudiosList.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Trash2, Play, Pause, Download } from "lucide-react";
import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
} from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { getAuth } from "firebase/auth";

export interface AudioData {
  audioId: string;
  name?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  url: string;
  duration?: string;
  language?: string;
}

interface AudiosListProps {
  audios: AudioData[];
  onDelete: (audio: AudioData) => void;
  perPage?: number;
  /** uid del usuario autenticado (para construir la URL de descarga) */
  uid: string;
  /** función que retorna el idToken actual (inyectada desde el contenedor). Opcional. */
  getIdToken?: () => Promise<string>;
}

export function AudiosList({
  audios,
  onDelete,
  perPage = 16,
  uid,
  getIdToken,
}: AudiosListProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(audios.length / perPage);

  const paginated = useMemo(
    () => audios.slice((page - 1) * perPage, page * perPage),
    [audios, page, perPage]
  );

  if (audios.length === 0) {
    return <p className="text-muted-foreground">No tienes audios aún.</p>;
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Grid */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {paginated.map((audio) => (
          <MemoizedAudioCard
            key={audio.audioId}
            audio={audio}
            onDelete={onDelete}
            uid={uid}
            getIdToken={getIdToken}
          />
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-auto flex justify-center col-span-full">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage((p) => p - 1);
                  }}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === i + 1}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(i + 1);
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage((p) => p + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

function AudioCard({
  audio,
  onDelete,
  uid,
  getIdToken,
}: {
  audio: AudioData;
  onDelete: (a: AudioData) => void;
  uid: string;
  getIdToken?: () => Promise<string>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("No se pudo reproducir:", err);
      });
    }
  }, [isPlaying]);

  // 🔹 actualizar progreso con RAF (más fluido que onTimeUpdate)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const updateProgress = () => {
      if (el.duration) {
        setProgress((el.currentTime / el.duration) * 100);
      }
      frameRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      frameRef.current = requestAnimationFrame(updateProgress);
    } else if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying]);

  const downloadAudio = useCallback(async () => {
    try {
      // Fallbacks: uid y token desde Firebase Auth si no llegan por props
      const auth = getAuth();
      const realUid = uid || auth.currentUser?.uid || "";
      if (!realUid) {
        toast.error("Vuelve a iniciar sesión para descargar el audio");
        return;
      }

      const tokenFn =
        typeof getIdToken === "function"
          ? getIdToken
          : async () => {
              const u = auth.currentUser;
              if (!u) throw new Error("No hay sesión");
              return u.getIdToken();
            };

      const token = await tokenFn();

      const res = await fetch(
        `/api/firebase/users/${realUid}/audios/${audio.audioId}?download=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error ${res.status}`);
      }
      const blob = await res.blob();

      // Nombre de archivo
      const cd = res.headers.get("content-disposition") || "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const fallback =
        (audio.name?.trim() ? audio.name.trim() : `audio-${audio.audioId}`) +
        guessExt(res.headers.get("content-type"));
      const filename = (match?.[1] || fallback).replace(/[\\/:*?"<>|]+/g, "_");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Download failed:", e);
      toast.error("❌ No se pudo descargar el audio");
    }
  }, [audio.audioId, audio.name, getIdToken, uid]);

  function guessExt(ct: string | null) {
    if (!ct) return ".mp3";
    const map: Record<string, string> = {
      "audio/mpeg": ".mp3",
      "audio/mp3": ".mp3",
      "audio/wav": ".wav",
      "audio/x-wav": ".wav",
      "audio/ogg": ".ogg",
      "audio/webm": ".webm",
      "audio/aac": ".aac",
      "audio/mp4": ".m4a",
      "audio/x-m4a": ".m4a",
    };
    return map[ct.toLowerCase()] ?? ".mp3";
  }

  return (
    <Card className="p-4 flex flex-col rounded-xl bg-card/90 border border-border shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold truncate">
            {audio.name || "Sin título"}
          </h3>
          {audio.description && (
            <p className="text-xs text-muted-foreground truncate">
              {audio.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Descargar audio"
            onClick={downloadAudio}
            className="p-2 rounded-full hover:bg-muted transition"
            title="Descargar"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            aria-label="Eliminar audio"
            onClick={() => onDelete(audio)}
            className="p-2 rounded-full hover:bg-muted transition"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Player */}
      <div className="flex items-center gap-3">
        <button
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          onClick={togglePlay}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted transition"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            readOnly
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audio.url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
      />
    </Card>
  );
}

const MemoizedAudioCard = memo(AudioCard);

