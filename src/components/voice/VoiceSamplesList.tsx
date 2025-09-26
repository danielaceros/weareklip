// src/components/voice/VoiceSamplesList.tsx
"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Trash2, Play, Pause } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useT } from "@/lib/i18n";

// 🔹 Constantes para feedback
const MIN_SAMPLE_DURATION = 5;   // evitar audios demasiado cortos (<5s casi inútiles)
const MAX_SAMPLE_DURATION = 600; // 10 min por muestra recomendado

interface Sample {
  name: string;
  duration: number;
  url: string;
}

interface VoiceSamplesListProps {
  samples: Sample[];
  uploadProgress: { [key: string]: number };
  onRemove: (name: string) => void;
  perPage?: number;
}

export function VoiceSamplesList({
  samples,
  uploadProgress,
  onRemove,
  perPage = 2,
}: VoiceSamplesListProps) {
  const t = useT();
  const [playing, setPlaying] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  if (samples.length === 0) return null;

  const totalPages = Math.ceil(samples.length / perPage);
  const paginated = samples.slice((page - 1) * perPage, page * perPage);

  const togglePlay = (name: string) => {
    const current = audioRefs.current[name];
    if (!current) return;

    if (playing === name) {
      current.pause();
      setPlaying(null);
    } else {
      Object.values(audioRefs.current).forEach((a) => a?.pause());
      current.play();
      setPlaying(name);
    }
  };

  const durationLabel = (duration: number) => {
    const seconds = Math.round(duration);
    if (duration < MIN_SAMPLE_DURATION) {
      return (
        <span className="text-[11px] sm:text-xs text-destructive font-medium">
          {t("voices.samples.duration.short", { seconds })}
        </span>
      );
    }
    if (duration > MAX_SAMPLE_DURATION) {
      return (
        <span className="text-[11px] sm:text-xs text-yellow-600 font-medium">
          {t("voices.samples.duration.long", { seconds })}
        </span>
      );
    }
    return (
      <span className="text-[11px] sm:text-xs text-muted-foreground">
        {t("voices.samples.duration.normal", { seconds })}
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Grid de samples */}
      <div
        className="
          grid gap-4
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
        "
      >
        {paginated.map(({ name, duration, url }) => (
          <Card
            key={name}
            className="p-3 sm:p-4 bg-card border border-border rounded-lg shadow-sm flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-semibold truncate">
                {name || t("voices.samples.untitled")}
              </h3>
              <button
                onClick={() => onRemove(name)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-muted transition"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>

            {/* Upload progress o reproductor */}
            {uploadProgress[name] !== undefined ? (
              <div className="w-full bg-muted h-1.5 sm:h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${uploadProgress[name]}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Play / Pause */}
                <button
                  onClick={() => togglePlay(name)}
                  className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border hover:bg-muted transition"
                >
                  {playing === name ? (
                    <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </button>

                {/* Slider manual */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={
                    audioRefs.current[name]?.currentTime &&
                    audioRefs.current[name]?.duration
                      ? (audioRefs.current[name]!.currentTime /
                          audioRefs.current[name]!.duration) *
                        100
                      : 0
                  }
                  onChange={(e) => {
                    const current = audioRefs.current[name];
                    if (current) {
                      current.currentTime =
                        (parseFloat(e.target.value) / 100) *
                        current.duration;
                    }
                  }}
                  className="flex-1 accent-primary h-1 sm:h-1.5"
                />

                {/* Hidden audio */}
                <audio
                  ref={(el) => {
                    audioRefs.current[name] = el;
                  }}
                  src={url}
                  onEnded={() => setPlaying(null)}
                  onPause={() =>
                    setPlaying((prev) => (prev === name ? null : prev))
                  }
                />
              </div>
            )}

            {/* Duración con feedback */}
            <div className="mt-1 sm:mt-2">{durationLabel(duration)}</div>
          </Card>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
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
                    if (page < totalPages) setPage(page + 1);
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
