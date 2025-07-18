"use client";

import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/types/video";

type Props = {
  videos: Video[];
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  onUpload: (file: File, title: string) => void;
  uploadProgress: number | null;
  setArchivoVideo: (file: File | null) => void;
  archivoVideo: File | null;
  nuevoTitulo: string;
  setNuevoTitulo: (value: string) => void;
  onSelect: (video: Video) => void;
};

const estados: Record<number, React.ReactNode> = {
  0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
  1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
  2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
};

export default function VideosSection({
  videos,
  modalOpen,
  setModalOpen,
  onUpload,
  uploadProgress,
  archivoVideo,
  setArchivoVideo,
  nuevoTitulo,
  setNuevoTitulo,
  onSelect,
}: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length) {
        setArchivoVideo(files[0]);
      }
    },
  });

  const handleSubmit = () => {
    if (archivoVideo && nuevoTitulo.trim()) {
      onUpload(archivoVideo, nuevoTitulo.trim());
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">🎬 Videos</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTitle className="text-xl font-semibold">Videos</DialogTitle>
          <DialogTrigger asChild>
            <Button>+ Crear</Button>
          </DialogTrigger>
          <DialogContent>
            <h3 className="font-semibold text-lg mb-2">Subir video</h3>
            <Input
              placeholder="Título del video"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
            />
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-md p-4 text-center cursor-pointer ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} />
              {archivoVideo ? (
                <p className="text-sm truncate">{archivoVideo.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Arrastra un video aquí o haz clic para seleccionar uno (máx. 100MB)
                </p>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              className="mt-2 w-full"
              disabled={uploadProgress !== null || !nuevoTitulo.trim() || !archivoVideo}
            >
              {uploadProgress !== null
                ? `Subiendo... ${uploadProgress.toFixed(0)}%`
                : "Subir"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length === 0 ? (
        <p className="text-muted-foreground">Este cliente no tiene videos aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Card
              key={v.firebaseId}
              className="p-3 cursor-pointer"
              onClick={() => onSelect(v)}
              tabIndex={0}
              role="button"
              aria-label={`Seleccionar video ${v.titulo}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(v);
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-base truncate">{v.titulo}</p>
                {v.estado !== undefined ? (
                  estados[v.estado] ?? <Badge variant="secondary">Desconocido</Badge>
                ) : null}
              </div>
              <video
                controls
                src={v.url}
                className="rounded w-full aspect-[9/16] object-cover"
                preload="metadata"
                aria-label={`Video: ${v.titulo}`}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
