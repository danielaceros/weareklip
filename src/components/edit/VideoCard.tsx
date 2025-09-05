// src/app/dashboard/edit/VideoCard.tsx
"use client";

import { FC, useState } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { getStatusBadge } from "./videoUtils";
import { useTranslations } from "next-intl";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  storagePath?: string;
  duration?: number;
  completedAt?: string;
  thumbnail?: string;
}

interface Props {
  video: VideoData;
  onDelete: () => void;
}

/* 🎥 Player ligero estilo IdeasVirales */
const VideoThumbPlayer: FC<{ url: string; title: string; thumbnail?: string }> = ({
  url,
  title,
  thumbnail,
}) => {
  const [active, setActive] = useState(false);
  const t = useTranslations("video.card");

  return (
    <div className="relative w-full aspect-[9/16] overflow-hidden bg-black rounded-md">
      {!active && (
        <button
          type="button"
          aria-label={t("ariaPlay", { title })}
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
            {t("playHere")}
          </span>
        </button>
      )}

      {active && (
        <video
          controls
          src={url}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline
        />
      )}
    </div>
  );
};

/* 📦 Card principal */
const VideoCard: FC<Props> = ({ video, onDelete }) => {
  const t = useTranslations("video.card");

  return (
    <Card className="overflow-hidden rounded-xl border bg-card text-foreground flex flex-col">
      {/* Header */}
      <CardHeader className="p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="h-8 w-8 shrink-0 self-end sm:self-start"
          aria-label="Delete video"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold truncate">
            {video.title || t("untitled")}
          </h3>
          <div className="mt-1">{getStatusBadge(video.status)}</div>
        </div>
      </CardHeader>

      {/* Preview */}
      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <VideoThumbPlayer
            url={video.downloadUrl}
            title={video.title}
            thumbnail={video.thumbnail}
          />
        ) : (
          <div className="w-full aspect-[9/16] flex items-center justify-center text-xs sm:text-sm text-muted-foreground bg-black/30 rounded-md">
            {video.status === "processing"
              ? t("processing")
              : video.status === "error"
              ? t("error")
              : t("waiting")}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      {video.downloadUrl && video.status === "completed" && (
        <CardFooter className="p-3 flex flex-col sm:flex-row justify-between items-center gap-2">
          <Button size="sm" variant="secondary" asChild className="w-full sm:w-auto rounded-lg">
            <a href={video.downloadUrl} target="_blank" rel="noopener noreferrer">
              {t("download")}
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default VideoCard;
