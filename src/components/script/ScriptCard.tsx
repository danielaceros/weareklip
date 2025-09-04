"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Star } from "lucide-react";
import Image from "next/image";

interface ScriptCardProps {
  script: ScriptData;
  onView: () => void;
  onDelete: () => void;
}

interface ScriptData {
  scriptId: string;
  isAI?: boolean;
  ctaText?: string;
  platform?: string;
  addCTA?: boolean;
  structure?: string;
  tone?: string;
  duration?: string;
  language?: string;
  description?: string;   // título/desc (AI)
  script?: string;        // transcripción
  rating?: number;
  createdAt?: { seconds: number; nanoseconds: number };
  fuente?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoChannel?: string;
  videoPublishedAt?: string;
  videoViews?: number;
  videoThumbnail?: string;
}

export function ScriptCard({ script, onView, onDelete }: ScriptCardProps) {
  // 🔹 Optimizamos cálculos con useMemo
  const title = useMemo(
    () =>
      script.isAI
        ? script.description || "Sin título"
        : script.videoTitle || "Vídeo replicado",
    [script.isAI, script.description, script.videoTitle]
  );

  const chips = useMemo(
    () =>
      [
        script.platform,
        script.duration,
        script.structure || (script.isAI ? "Storytelling" : undefined),
      ].filter(Boolean) as string[],
    [script.platform, script.duration, script.structure, script.isAI]
  );

  return (
    <Card className="rounded-xl border border-border bg-card/95 shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex flex-col h-full p-3 space-y-2">
        {/* 1) Título */}
        <h3 className="text-sm font-semibold leading-5 line-clamp-1">{title}</h3>

        {/* 2) Rating */}
        {script.rating !== undefined ? (
          <div className="flex gap-0.5" aria-label={`Valoración ${script.rating}/5`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3.5 w-3.5 ${
                  script.rating && script.rating >= star
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin valorar</p>
        )}

        {/* 3) Contenido */}
        <div className="text-xs text-muted-foreground leading-relaxed">
          {script.isAI ? (
            <p className="line-clamp-4">{script.script || "Sin contenido"}</p>
          ) : (
            <>
              {script.videoThumbnail ? (
                <div className="relative mb-2 w-full overflow-hidden rounded-md border border-border/60 bg-muted/30 aspect-video">
                  <Image
                    src={script.videoThumbnail}
                    alt={script.videoTitle || "Miniatura de video"}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-24 flex items-center justify-center text-xs text-muted-foreground border rounded bg-muted/20">
                  Preview no disponible
                </div>
              )}
              <p className="line-clamp-3">
                {script.videoDescription || script.script || "Sin contenido"}
              </p>
            </>
          )}
        </div>

        {/* 4) Chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <Badge
                key={c}
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-foreground"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}

        {/* 5) Acciones */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 rounded-md bg-muted text-foreground hover:bg-muted/90 text-sm transition"
            onClick={onView}
            aria-label={`Ver guion: ${title}`}
          >
            Ver
          </Button>

          <button
            aria-label={`Eliminar guion: ${title}`}
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

