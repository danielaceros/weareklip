// src/components/audio/AudiosList.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, Pause, Download, Timer } from "lucide-react";
import { useRef, useState, useCallback, useMemo, useEffect, memo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";

// ✅ i18n
import { useTranslations } from "next-intl";

export interface AudioData {
  audioId: string;
  name?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  url: string;
  duration?: number;     // duración guardada en backend (opcional)
  language?: string;     // "es" | "en" | "fr" (opcional)
}

interface AudiosListProps {
  audios: AudioData[];         // ← FIX: array, no objeto
  onDelete: (audio: AudioData) => void;
  perPage?: number;
}

const MAX_SEC = 60;

export function AudiosList({
  audios,
  onDelete,
  perPage = 16,
}: AudiosListProps) {
  const t = useTranslations();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(audios.length / perPage);

  const paginated = useMemo<AudioData[]>(
    () => audios.slice((page - 1) * perPage, page * perPage),
    [audios, page, perPage]
  );

  if (audios.length === 0) {
    return <p className="text-muted-foreground">{t("audiosList.empty")}</p>;
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

function formatTime(totalSeconds?: number) {
  if (!totalSeconds || isNaN(totalSeconds)) return "00:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AudioCard({
  audio,
  onDelete,
}: {
  audio: AudioData;
  onDelete: (a: AudioData) => void;
}) {
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(audio.duration);
  const frameRef = useRef<number | null>(null);

  const title = audio.name || t("audioCard.untitled");
  const lang = (audio.language || "").toUpperCase();
  const isOverCap = (duration ?? 0) > MAX_SEC;

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current
        .play()
        .catch((err) => {
          console.warn("No se pudo reproducir:", err);
        });
    }
  }, [isPlaying]);

  // ⬇️ Descargar vía endpoint propio (misma-origin)
  const handleDownload = useCallback(() => {
    if (!audio?.url) return;
    const safeBase =
      (audio.name?.trim() || "audio").replace(/[^\w\-\. ]+/g, "") || "audio";
    const href = `/api/download-audio?u=${encodeURIComponent(
      audio.url
    )}&filename=${encodeURIComponent(safeBase)}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${safeBase}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [audio?.url, audio?.name]);

  // 🔹 actualizar progreso con RAF y cortar a 60s
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const updateProgress = () => {
      const dur = el.duration || duration || 0;
      const current = el.currentTime || 0;

      // Cap de reproducción a 60s (para audios antiguos más largos)
      if (current >= MAX_SEC) {
        el.pause();
        el.currentTime = MAX_SEC;
        setIsPlaying(false);
        setProgressPct(dur ? (MAX_SEC / dur) * 100 : 100);
        try {
          toast.warning(t("audioCard.toasts.capReached", { max: MAX_SEC }));
        } catch {
          toast.warning(`Se alcanzó el máximo de ${MAX_SEC}s`);
        }
      } else if (dur) {
        setProgressPct((current / dur) * 100);
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
  }, [isPlaying, duration, t]);

  return (
    <Card className="p-4 flex flex-col rounded-xl bg-card/90 border border-border shadow-sm h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {audio.description && (
            <p className="text-xs text-muted-foreground truncate">
              {audio.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{formatTime(duration)}</span>
              <span>•</span>
              <span>{lang || "—"}</span>
            </div>
            {isOverCap && (
              <Badge variant="destructive" className="h-5 px-2 text-[11px]">
                {t("audioCard.badges.overCap", { max: MAX_SEC })}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            aria-label={t("audioCard.aria.download")}
            title={t("audioCard.titles.download")}
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-muted transition"
            disabled={!audio.url}
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            aria-label={t("audioCard.aria.delete")}
            onClick={() => onDelete(audio)}
            className="p-2 rounded-full hover:bg-muted transition"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Player */}
      <div className="flex items-center gap-3">
        <button
          aria-label={
            isPlaying ? t("audioCard.aria.pause") : t("audioCard.aria.play")
          }
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
            value={progressPct}
            readOnly
            className="w-full accent-primary"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>
              {formatTime(
                Math.min(MAX_SEC, (audioRef.current?.currentTime ?? 0))
              )}
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audio.url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(isFinite(d) ? d : undefined);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgressPct(0);
        }}
      />
    </Card>
  );
}

const MemoizedAudioCard = memo(AudioCard);
