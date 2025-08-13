"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
  return (
    <Dialog open={!!script} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        {script && (
          <>
            <DialogHeader>
              <DialogTitle>
                {script.isAI ? script.description : script.videoTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {script.isAI ? (
                <>
                  <div className="flex gap-2 flex-wrap">
                    <Badge>{script.platform}</Badge>
                    <Badge>{script.duration}</Badge>
                    <Badge>{script.structure}</Badge>
                    <Badge>{script.tone}</Badge>
                    {script.addCTA && <Badge>CTA: {script.ctaText || "Sí"}</Badge>}
                  </div>
                  <p className="whitespace-pre-wrap">{script.script}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 cursor-pointer ${
                          script.rating && script.rating >= star
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                        onClick={() => onRating(script.scriptId, star)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {script.videoThumbnail && (
                    <Image
                      src={script.videoThumbnail}
                      alt={script.videoTitle || ""}
                      width={800}
                      height={450}
                      className="rounded w-full"
                    />
                  )}
                  <p className="text-sm text-gray-500">
                    Canal: {script.videoChannel} <br />
                    Publicado: {script.videoPublishedAt} <br />
                    Views: {script.videoViews?.toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{script.script}</p>
                  <a
                    href={script.fuente}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline text-sm"
                  >
                    Ver video original
                  </a>
                </>
              )}

              {script.script && (
                <Link href={`/dashboard/audio/new?text=${encodeURIComponent(script.script)}`}>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                    Clonar texto con voz
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
