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
    <Card className="overflow-hidden">
      <CardHeader className="p-3 flex justify-between items-start">
        <div>
          <h3 className="text-sm font-bold truncate">{video.title || "Sin título"}</h3>
          <div>{getStatusBadge(video.status)}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {video.downloadUrl ? (
          <video
            controls
            src={video.downloadUrl}
            className="w-full aspect-[9/16] object-cover"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 text-xs p-4">
            {video.status === "processing" ? "En proceso..." : "Esperando datos..."}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 flex justify-between items-center">
        {video.downloadUrl && (
          <Button size="sm" variant="secondary" asChild>
            <a href={video.downloadUrl} target="_blank" rel="noopener noreferrer">
              Descargar
            </a>
          </Button>
        )}
        {video.duration && (
          <span className="text-xs text-gray-500">⏱ {video.duration}s</span>
        )}
      </CardFooter>
    </Card>
  );
}
