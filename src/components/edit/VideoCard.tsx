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

export default function VideoCard({ video }: Props) {
  return (
    <Card className="overflow-hidden rounded-xl bg-card/90 border border-border shadow-sm">
      {/* Header */}
      <CardHeader className="p-3">
        <h3 className="text-base font-semibold truncate">
          {video.title || "Sin título"}
        </h3>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <video
            controls
            src={video.downloadUrl}
            className="w-full aspect-[9/16] object-cover"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            En proceso...
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="p-3 flex flex-col gap-2">
        {video.downloadUrl && (
          <Button
            size="lg"
            className="w-full rounded-lg"
            asChild
          >
            <a
              href={video.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar
            </a>
          </Button>
        )}
        {video.duration && (
          <span className="text-xs text-muted-foreground text-center">
            ⏱ {video.duration}s
          </span>
        )}
      </CardFooter>
    </Card>
  );
}