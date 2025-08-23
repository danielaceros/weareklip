"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2, Eye, Upload } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
}

interface ClonacionVideosSectionProps {
  t: (key: string) => string;
  clonacionVideos: ClonacionVideo[];
  handleUpload: (file: File) => void;
  handleDelete: (id: string) => void;
  uploading: boolean;
  progress: number;
}

export default function ClonacionVideosSection({
  t,
  clonacionVideos,
  handleUpload,
  handleDelete,
  uploading,
  progress,
}: ClonacionVideosSectionProps) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  return (
    <Card className="p-6 shadow-sm bg-card text-card-foreground">
      <div>
        <h2 className="text-xl font-semibold">{t("clonacion.sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("clonacion.sectionSubtitle")}
        </p>
      </div>

      <Separator className="my-4" />

      {/* Input estilizado */}
      <div className="mb-6">
        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:bg-muted/40 transition">
          <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
          <span className="text-sm font-medium">{t("clonacion.uploadPrompt")}</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUpload(e.target.files[0]);
              }
            }}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Barra de progreso */}
      {uploading && (
        <div className="mb-6">
          <Progress value={progress} className="w-full" />
          <p className="text-sm mt-1 text-muted-foreground">
            {progress}% {t("clonacion.uploading")}
          </p>
        </div>
      )}

      {/* Lista de videos */}
      {clonacionVideos.length === 0 ? (
        <p className="text-muted-foreground italic">{t("clonacion.noVideos")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {clonacionVideos.map((video, idx) => (
            <div
              key={video.id ?? video.url ?? idx} // 👈 asegura un key único
              className="relative group rounded-lg overflow-hidden border border-border"
            >
              {/* Miniatura */}
              {video.thumbnail ? (
                <Image
                  src={video.thumbnail}
                  alt="thumbnail"
                  width={200}
                  height={200}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <video
                  src={video.url}
                  className="w-full h-32 object-cover"
                  muted
                />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setSelectedVideo(video.url)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => handleDelete(video.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de vista previa */}
      <Dialog
        open={!!selectedVideo}
        onOpenChange={() => setSelectedVideo(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("clonacion.previewTitle")}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <video
              src={selectedVideo}
              controls
              autoPlay
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
