"use client";

import { Card } from "@/components/ui/card";
import { Trash2, Play, Pause } from "lucide-react";
import { useRef, useState, useCallback, useMemo, useEffect, memo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// ✅ i18n
import { useTranslations } from "next-intl";

export interface AudioData {
  audioId: string;
  name?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  url: string;
  duration?: number;
  language?: string;
}

interface AudiosListProps {
  audios: AudioData[];
  onDelete: (audio: AudioData) => void;
  perPage?: number;
}

export function AudiosList({
  audios,
  onDelete,
  perPage = 16,
}: AudiosListProps) {
  const t = useTranslations();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(audios.length / perPage);

  const paginated = useMemo(
    () => audios.slice((page - 1) * perPage, page * perPage),
    [audios, page, perPage]
  );

  if (audios.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("audiosList.empty")}
      </p>
    );
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

function AudioCard({
  audio,
  onDelete,
}: {
  audio: AudioData;
  onDelete: (a: AudioData) => void;
}) {
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);

  const title = audio.name || t("audioCard.untitled");

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

  // 🔹 actualizar progreso con RAF
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

  return (
    <Card className="p-4 flex flex-col rounded-xl bg-card/90 border border-border shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {audio.description && (
            <p className="text-xs text-muted-foreground truncate">
              {audio.description}
            </p>
          )}
        </div>
        <button
          aria-label={t("audioCard.aria.delete")}
          onClick={() => onDelete(audio)}
          className="p-2 rounded-full hover:bg-muted transition"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Player */}
      <div className="flex items-center gap-3">
        <button
          aria-label={isPlaying ? t("audioCard.aria.pause") : t("audioCard.aria.play")}
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
