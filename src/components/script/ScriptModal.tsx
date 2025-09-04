"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface ScriptModalProps {
  script: ScriptData | null;
  onClose: () => void;
  onRating: (scriptId: string, rating: number) => void;
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
  description?: string;
  script?: string;
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

export function ScriptModal({ script, onClose, onRating }: ScriptModalProps) {
  const [localRating, setLocalRating] = useState<number>(script?.rating || 0);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 🔄 Sync rating cuando cambia el script
  useEffect(() => {
    if (script?.rating !== undefined) {
      setLocalRating(script.rating);
    }
  }, [script?.rating]);

  const handleRate = useCallback(
    (star: number) => {
      if (!script) return;
      setLocalRating(star); // UI inmediata
      onRating(script.scriptId, star); // notificar padre
    },
    [script, onRating]
  );

  // Memoizar estrellas para no recalcular array
  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  if (!script) return null;

  return (
    <Dialog open={!!script} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {script.isAI ? script.description : script.videoTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {script.isAI ? (
            <>
              {/* Tags */}
              <div className="flex gap-2 flex-wrap">
                {script.platform && <Badge>{script.platform}</Badge>}
                {script.duration && <Badge>{script.duration}</Badge>}
                {script.structure && <Badge>{script.structure}</Badge>}
                {script.tone && <Badge>{script.tone}</Badge>}
                {script.addCTA && (
                  <Badge>CTA: {script.ctaText || "Sí"}</Badge>
                )}
              </div>

              {/* Rating con animación */}
              <div className="flex gap-1">
                {stars.map((star) => {
                  const filled = (hoveredStar ?? localRating) >= star;
                  return (
                    <motion.button
                      key={star}
                      aria-label={`Valorar con ${star} estrellas`}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.15 }}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      onClick={() => handleRate(star)}
                      className="focus:outline-none transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors duration-150 ${
                          filled
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </motion.button>
                  );
                })}
              </div>

              {/* Texto del script */}
              <p className="whitespace-pre-wrap leading-relaxed text-sm">
                {script.script}
              </p>
            </>
          ) : (
            <>
              {script.videoThumbnail ? (
                <div className="relative w-full h-auto">
                  {!imgLoaded && (
                    <div className="w-full h-40 bg-neutral-800 animate-pulse rounded" />
                  )}
                  <Image
                    src={script.videoThumbnail}
                    alt={script.videoTitle || ""}
                    width={800}
                    height={450}
                    onLoadingComplete={() => setImgLoaded(true)}
                    className={`rounded w-full transition-opacity duration-300 ${
                      imgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-sm text-muted-foreground border rounded">
                  Preview no disponible
                </div>
              )}

              <p className="text-sm text-gray-500 leading-snug">
                Canal: {script.videoChannel || "Desconocido"} <br />
                Publicado: {script.videoPublishedAt || "N/A"} <br />
              </p>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {script.script}
              </p>

              {script.fuente && (
                <Link
                  href={script.fuente}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline text-sm"
                >
                  Ver video original
                </Link>
              )}
            </>
          )}

          {/* CTA */}
          {script.script && (
            <Link
              href={`/dashboard/audio/new?text=${encodeURIComponent(
                script.script
              )}`}
            >
              <Button className="rounded-lg w-full">
                Clonar texto con voz
              </Button>
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

