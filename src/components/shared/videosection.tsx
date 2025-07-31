"use client";

import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/types/video";
import EmptyState from "@/components/shared/EmptyState";
import toast from "react-hot-toast";

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
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Manejar archivos rechazados (demasiado grandes)
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        if (error.code === "file-too-large") {
          toast.error("❌ Error: El archivo es demasiado grande. Máximo permitido: 100MB");
        } else if (error.code === "file-invalid-type") {
          toast.error("❌ Error: Tipo de archivo no válido. Solo se permiten videos.");
        } else {
          toast.error("❌ Error: No se pudo procesar el archivo");
        }
        return;
      }

      // Manejar archivos aceptados
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Verificación adicional del tamaño (por si acaso)
        if (file.size > 100 * 1024 * 1024) {
          toast.error("❌ Error: El archivo es demasiado grande. Máximo permitido: 100MB");
          return;
        }
        
        setArchivoVideo(file);
        toast.success(`✅ Archivo "${file.name}" seleccionado correctamente`);
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
        <EmptyState>
          <p>🎬 Aún no hay videos para este cliente.</p>
          <p className="mt-2">
            → Usa el botón{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="hover:bg-black hover:text-white"
            >
              + Crear
            </Button>{" "}
            para añadir el primero.
          </p>
        </EmptyState>
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