"use client";

import { Card } from "@/components/ui/card";
import { Trash2, Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
}

export function AudiosList({ audios, onDelete, perPage = 16 }: AudiosListProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(audios.length / perPage);
  const paginated = audios.slice((page - 1) * perPage, page * perPage);

  if (audios.length === 0) return <p>No tienes audios aún.</p>;

  return (
  <div className="flex flex-col h-full space-y-6">
    {/* Grid responsivo */}
    <div
      className="
        grid gap-4
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-4
      "
    >
      {paginated.map((audio) => (
        <AudioCard key={audio.audioId} audio={audio} onDelete={onDelete} />
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

function AudioCard({
  audio,
  onDelete,
}: {
  audio: AudioData;
  onDelete: (audio: AudioData) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("No se pudo reproducir:", err);
      });
    }
  };

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
        <button
          onClick={() => onDelete(audio)}
          className="p-2 rounded-full hover:bg-muted transition"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Player */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted transition"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={() => {}}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audio.url}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress((el.currentTime / el.duration) * 100 || 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
      />

      {/* Footer con metadatos */}
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        {audio.language && <span>🌍 {audio.language}</span>}
        {audio.duration && <span>⏱ {audio.duration}</span>}
      </div>
    </Card>
  );
}
