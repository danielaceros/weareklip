"use client";

import { FC, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import ShareVideo from "@/components/shared/ShareVideo";

/* ---------- Tipos ---------- */
export interface VideoData {
  id?: string; // soporta id...
  projectId?: string; // ...o projectId
  title: string;
  status: string; // "completed" | "processing" | "error" | ...
  downloadUrl?: string;
  thumbnail?: string;
  // 🔑 para el estado inicial del share:
  public?: boolean;
  uid_share?: string | null;
}

interface Props {
  video: VideoData;
  onDelete: (id: string, url?: string) => void;
}

/* ---------- Player ligero (más compacto) ---------- */
const VideoThumbPlayer: FC<{
  url: string;
  title: string;
  thumbnail?: string;
}> = ({ url, title, thumbnail }) => {
  const [active, setActive] = useState(false);

  return (
    <div className="w-full flex justify-center">
      {/* limitamos el tamaño para que no “coma” toda la pantalla */}
      <div className="relative w-full max-w-[360px] sm:max-w-[380px] md:max-w-[420px] aspect-[9/16] overflow-hidden bg-black rounded-md">
        {!active ? (
          <button
            type="button"
            aria-label={`Reproducir: ${title}`}
            onClick={() => setActive(true)}
            className="group absolute inset-0 grid place-items-center"
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover opacity-90 transition group-hover:opacity-100"
              />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-black/40" />
            )}
            <span className="absolute grid place-items-center rounded-full px-4 py-3 bg-white/90 backdrop-blur text-black text-sm font-semibold shadow-lg transition group-hover:scale-105">
              ▶ Ver aquí
            </span>
          </button>
        ) : (
          <video
            controls
            src={url}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            playsInline
          />
        )}
      </div>
    </div>
  );
};

/* ---------- Card principal ---------- */
const VideoCard: FC<Props> = ({ video, onDelete }) => {
  const id = video.id ?? video.projectId ?? "";

  return (
    <Card className="overflow-hidden rounded-xl border bg-card text-foreground flex flex-col">
      <CardHeader className="p-3 flex justify-between items-center">
        <h3 className="text-sm font-semibold truncate">
          {video.title || "Sin título"}
        </h3>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(id, video.downloadUrl)}
          className="h-8 w-8 shrink-0"
          aria-label="Eliminar vídeo"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <VideoThumbPlayer
            url={video.downloadUrl}
            title={video.title}
            thumbnail={video.thumbnail}
          />
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[360px] sm:max-w-[380px] md:max-w-[420px] aspect-[9/16] flex items-center justify-center text-xs text-muted-foreground bg-black/30 rounded-md">
              {video.status === "processing"
                ? "Procesando..."
                : video.status === "error"
                ? "Error al generar"
                : "En espera"}
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer = igual que Lipsync (chip) + acciones */}
      <CardFooter className="p-3 flex flex-col gap-2">
        <ShareVideo
          docId={id}
          kind="videos"
          isPublic={!!video.public}
          shareId={video.uid_share ?? null}
          variant="chip" // ⬅️ estilo “✓ Enlace + X”
          className="h-8"
        />

        {video.downloadUrl && video.status === "completed" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="flex-1 min-w-[100px] rounded-lg"
            >
              <a
                href={video.downloadUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                Descargar
              </a>
            </Button>

            <Button
              size="sm"
              variant="default"
              className="flex-1 min-w-[100px] rounded-lg"
              onClick={() =>
                (window.location.href = `/dashboard/edit/new?videoUrl=${encodeURIComponent(
                  video.downloadUrl!
                )}`)
              }
            >
              Autoeditar
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default VideoCard;
