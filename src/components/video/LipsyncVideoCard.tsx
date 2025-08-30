"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
}

interface LipsyncVideoCardProps {
  video: VideoData;
  onDelete: (id: string, url?: string) => void;
}

export function LipsyncVideoCard({ video, onDelete }: LipsyncVideoCardProps) {
  return (
    <Card className="overflow-hidden rounded-xl border bg-muted text-foreground w-full relative">
      {/* Header */}
      <CardHeader className="p-3 pr-10">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(video.projectId, video.downloadUrl)}
          className="self-end sm:self-start h-8 w-8 shrink-0"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
        <h3 className="text-sm font-semibold truncate">
          {video.title || "Sin título"}
        </h3>
        
      </CardHeader>

      {/* Preview */}
      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <video
            controls
            src={video.downloadUrl}
            className="w-full aspect-[9/16] object-cover rounded-md"
          />
        ) : (
          <div className="w-full aspect-[9/16] flex items-center justify-center text-xs text-muted-foreground bg-black/30 rounded-md">
            {video.status === "processing"
              ? "Procesando..."
              : video.status === "error"
              ? "Error al generar"
              : "En espera"}
          </div>
        )}
      </CardContent>

      {/* Footer con acciones */}
      {video.downloadUrl && video.status === "completed" && (
        <CardFooter className="p-3 flex justify-between items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" asChild className="flex-1 min-w-[100px]">
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
            className="flex-1 min-w-[100px]"
            onClick={() =>
              (window.location.href = `/dashboard/edit/new?videoUrl=${encodeURIComponent(
                video.downloadUrl!
              )}`)
            }
          >
            Autoeditar
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
