"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Video } from "@/types/video";
import { useState, useEffect } from "react";

type Props = {
  video: Video | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSave: (video: Video & { nuevoArchivo?: File }) => void;
};

export default function EditarVideoModal({
  video,
  onClose,
  onDelete,
  onSave,
}: Props) {
  const [localEstado, setLocalEstado] = useState<number>(video?.estado ?? 0);
  const [localNotas, setLocalNotas] = useState<string>(video?.notas ?? "");
  const [localTitulo, setLocalTitulo] = useState<string>(video?.titulo ?? "");
  const [nuevoArchivo, setNuevoArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (video) {
      setLocalEstado(video.estado);
      setLocalNotas(video.notas ?? "");
      setLocalTitulo(video.titulo);
      setNuevoArchivo(null);
      setPreviewUrl(null);
    }
  }, [video]);

  const handleGuardar = () => {
    if (!video) return;
    onSave({
      ...video,
      estado: localEstado,
      notas: localNotas,
      titulo: localTitulo.trim(),
      ...(nuevoArchivo && { nuevoArchivo }),
    });
  };

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNuevoArchivo(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const showCorrecciones = localEstado === 1;

  return (
    <Dialog open={!!video} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-auto">
        <DialogTitle className="text-lg font-bold mb-4">Editar Video</DialogTitle>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Vista previa del vídeo */}
          <div className="md:flex-1 max-h-[50vh]">
            <video
              controls
              src={previewUrl || video?.url}
              className="w-full h-full object-contain rounded"
              preload="metadata"
              aria-label={`Previsualización del vídeo ${localTitulo}`}
            />
            <input
              type="file"
              accept="video/*"
              onChange={handleArchivoChange}
              className="mt-4"
              aria-label="Reemplazar vídeo"
            />
          </div>

          {/* Información y controles */}
          <div className="md:flex-1 flex flex-col">
            <input
              type="text"
              value={localTitulo}
              onChange={(e) => setLocalTitulo(e.target.value)}
              className="mb-4 p-2 border rounded w-full"
              placeholder="Título del vídeo"
              aria-label="Editar título del vídeo"
            />

            <label className="block mb-2 font-semibold">
              Estado:
              <select
                className="ml-2 p-1 border rounded"
                value={localEstado}
                onChange={(e) => setLocalEstado(Number(e.target.value))}
                aria-label="Seleccionar estado del vídeo"
              >
                <option value={0}>🆕 Nuevo</option>
                <option value={1}>✏️ Necesita Cambios</option>
                <option value={2}>✅ Aprobado</option>
              </select>
            </label>

            {showCorrecciones && (
              <label className="block mt-4 flex-grow">
                Notas para correcciones:
                <textarea
                  className="w-full mt-1 p-2 border rounded resize-y h-full"
                  rows={4}
                  value={localNotas}
                  onChange={(e) => setLocalNotas(e.target.value)}
                  placeholder="Escribe las correcciones necesarias..."
                  aria-label="Notas para correcciones"
                />
              </label>
            )}

            <div className="flex gap-2 mt-6">
              <Button
                variant="destructive"
                onClick={() => video && onDelete(video.firebaseId)}
              >
                Eliminar
              </Button>
              <Button onClick={handleGuardar}>Guardar Cambios</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
