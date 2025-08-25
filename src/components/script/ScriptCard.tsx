"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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
  // si replica de vídeo:
  fuente?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoChannel?: string;
  videoPublishedAt?: string;
  videoViews?: number;
  videoThumbnail?: string;
}

export function ScriptCard({ script, onView, onDelete }: ScriptCardProps) {
  const title = script.isAI
    ? script.description || "Sin título"
    : script.videoTitle || "Vídeo replicado";

  const chips = [
    script.platform,
    script.duration,
    script.structure || (script.isAI ? "Storytelling" : undefined),
  ].filter(Boolean) as string[];

  return (
    <Card className="rounded-xl border border-border bg-card/95 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex flex-col h-full p-3 space-y-2">
        {/* 1) Título */}
        <h3 className="text-sm font-semibold leading-5 line-clamp-1">
          {title}
        </h3>

        {/* 2) Contenido */}
        <div className="text-xs text-muted-foreground leading-relaxed">
          {script.isAI ? (
            <p className="line-clamp-4">
              {script.script || "Sin contenido"}
            </p>
          ) : (
            <>
              {script.videoThumbnail && (
                <div className="relative mb-2 w-full overflow-hidden rounded-md border border-border/60 bg-muted/30 aspect-video">
                  <Image
                    src={script.videoThumbnail}
                    alt={script.videoTitle || ""}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <p className="line-clamp-3">
                {script.videoDescription || script.script || "Sin contenido"}
              </p>
            </>
          )}
        </div>

        {/* 3) Chips */}
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

        {/* 4) Acciones */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 rounded-md bg-muted text-foreground hover:bg-muted/90 text-sm"
            onClick={onView}
          >
            Ver
          </Button>

          <button
            aria-label="Eliminar"
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-destructive transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
