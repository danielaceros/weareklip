"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { getStatusBadge } from "./videoUtils";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  storagePath?: string;
  duration?: number;
  completedAt?: string;
}

interface Props {
  video: VideoData;
  onDelete: () => void;
}

export default function VideoCard({ video, onDelete }: Props) {
  return (
    <Card className="overflow-hidden rounded-xl border bg-muted text-foreground">
      {/* Header */}
      <CardHeader className="p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="self-end sm:self-start h-8 w-8 shrink-0"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold truncate">
            {video.title || "Sin título"}
          </h3>
          <div className="mt-1">{getStatusBadge(video.status)}</div>
        </div>
      </CardHeader>

      {/* Preview */}
      <CardContent className="p-0">
        {video.downloadUrl ? (
          <video
            controls
            src={video.downloadUrl}
            className="w-full aspect-[9/16] object-cover"
          />
        ) : (
          <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400 text-xs sm:text-sm p-4">
            {video.status === "processing" ? "En proceso..." : "Esperando datos..."}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="p-3 flex flex-col sm:flex-row justify-between items-center gap-2">
        {video.downloadUrl && (
          <Button
            size="sm"
            variant="default"
            asChild
            className="w-full"
          >
            <a href={video.downloadUrl} target="_blank" rel="noopener noreferrer">
              Descargar
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
