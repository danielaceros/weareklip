"use client";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
}

interface LipsyncVideoCardProps {
  video: VideoData;
}

export function LipsyncVideoCard({ video }: LipsyncVideoCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Completado</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Procesando</Badge>;
      case "error":
        return <Badge className="bg-red-500 hover:bg-red-600">Error</Badge>;
      default:
        return <Badge className="bg-gray-500">Desconocido</Badge>;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3">
        <h3 className="text-sm font-bold truncate">{video.title || "Sin título"}</h3>
        <div>{getStatusBadge(video.status)}</div>
      </CardHeader>

      <CardContent className="p-0">
        {video.downloadUrl && video.status === "completed" ? (
          <video
            controls
            src={video.downloadUrl}
            className="w-full aspect-[9/16] object-cover"
          />
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-xs p-4">
            En proceso...
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 flex justify-between items-center gap-2">
        {video.downloadUrl && (
          <>
            <Button size="sm" variant="secondary" asChild>
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
              onClick={() => {
                window.location.href = `/dashboard/edit/new?videoUrl=${encodeURIComponent(video.downloadUrl!)}`;
              }}
            >
              Autoeditar
            </Button>
          </>
        )}
        {video.duration && (
          <span className="text-xs text-gray-500">⏱ {video.duration}s</span>
        )}
      </CardFooter>
    </Card>
  );
}
