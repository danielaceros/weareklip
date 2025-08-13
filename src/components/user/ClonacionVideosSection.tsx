"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2, Eye } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
    <section className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm">
      <h2 className="text-xl font-semibold mb-4">
        {t("clonacion.sectionTitle")}
      </h2>

      {/* Input para subir */}
      <div className="mb-4">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleUpload(e.target.files[0]);
            }
          }}
          disabled={uploading}
        />
      </div>

      {/* Barra de progreso */}
      {uploading && (
        <div className="mb-4">
          <Progress value={progress} className="w-full" />
          <p className="text-sm mt-1">
            {progress}% {t("clonacion.uploading")}
          </p>
        </div>
      )}

      {/* Lista de videos */}
      {clonacionVideos.length === 0 ? (
        <p className="text-muted-foreground">{t("clonacion.noVideos")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {clonacionVideos.map((video) => (
            <div
              key={video.id}
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

              {/* Botones sobre miniatura */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
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
    </section>
  );
}
