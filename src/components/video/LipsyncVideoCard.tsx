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
import { useT } from "@/lib/i18n";

/* ---------- Tipos ---------- */
interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  thumbnail?: string;
}

interface LipsyncVideoCardProps {
  video: VideoData;
  onDelete: (id: string, url?: string) => void;
}

/* ---------- Player ligero ---------- */
const VideoThumbPlayer: FC<{
  url: string;
  title: string;
  thumbnail?: string;
}> = ({ url, title, thumbnail }) => {
  const t = useT();
  const [active, setActive] = useState(false);

  return (
    <div className="relative w-full aspect-[9/16] overflow-hidden bg-black rounded-md">
      {!active && (
        <button
          type="button"
          aria-label={t("lipsyncCard.ariaPlay", { title })}
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
            {t("lipsyncCard.playHere")}
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

/* ---------- Card principal ---------- */
export const LipsyncVideoCard: FC<LipsyncVideoCardProps> = ({
  video,
  onDelete,
}) => {
  const t = useT();

  const title = video.title || t("lipsyncCard.untitled");
  const statusNode =
    video.status === "processing"
      ? t("lipsyncCard.status.processing")
      : video.status === "error"
      ? t("lipsyncCard.status.error")
      : t("lipsyncCard.status.pending");

  return (
    <Card className="overflow-hidden rounded-xl border bg-card text-foreground flex flex-col">
      <CardHeader className="p-3 flex justify-between items-center">
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(video.projectId, video.downloadUrl)}
          className="h-8 w-8 shrink-0"
          aria-label={t("lipsyncCard.ariaDelete")}
          title={t("lipsyncCard.titleDelete")}
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <VideoThumbPlayer
            url={video.downloadUrl}
            title={title}
            thumbnail={video.thumbnail}
          />
        ) : (
          <div className="w-full aspect-[9/16] flex items-center justify-center text-xs text-muted-foreground bg-black/30 rounded-md">
            {statusNode}
          </div>
        )}
      </CardContent>

      {video.downloadUrl && video.status === "completed" && (
        <CardFooter className="p-3 flex items-center gap-2 flex-wrap">
          {/* Chip de compartir */}
          <ShareVideo
            docId={video.projectId}
            kind="lipsync"
            variant="chip"
            className="h-8"
          />

          {/* Acciones principales */}
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="min-w-[110px] rounded-lg"
            >
              <a
                href={video.downloadUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("lipsyncCard.download")}
              </a>
            </Button>

            <Button
              size="sm"
              variant="default"
              className="min-w-[110px] rounded-lg"
              onClick={() =>
                (window.location.href = `/dashboard/edit/new?videoUrl=${encodeURIComponent(
                  video.downloadUrl!
                )}`)
              }
            >
              {t("lipsyncCard.autoedit")}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};
