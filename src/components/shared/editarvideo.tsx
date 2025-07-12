"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Video } from "@/types/video";
import { Replace, Trash, Save } from "lucide-react";

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <DialogContent className="max-w-6xl w-full h-[85vh] p-4">
        <div className="flex h-full gap-4">
          {/* Panel izquierdo: Vídeo */}
          <div className="w-1/2 bg-black relative rounded-lg overflow-hidden flex items-center justify-center">
            <video
              controls
              src={previewUrl || video?.url}
              className="w-full h-full object-contain"
              preload="metadata"
              aria-label={`Previsualización del vídeo ${localTitulo}`}
            />
          </div>

          {/* Panel derecho: Formulario */}
          <div className="w-1/2 bg-white rounded-lg p-4 flex flex-col justify-between border shadow-sm">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <DialogTitle className="text-xl font-semibold">Editar Video</DialogTitle>

              <input
                type="text"
                value={localTitulo}
                onChange={(e) => setLocalTitulo(e.target.value)}
                className="p-2 border rounded w-full"
                placeholder="Título del vídeo"
                aria-label="Editar título del vídeo"
              />

              <div>
                <label className="font-semibold block mb-1">Estado:</label>
                <select
                  className="p-2 border rounded w-full"
                  value={localEstado}
                  onChange={(e) => setLocalEstado(Number(e.target.value))}
                  aria-label="Seleccionar estado del vídeo"
                >
                  <option value={0}>🆕 Nuevo</option>
                  <option value={1}>✏️ Necesita Cambios</option>
                  <option value={2}>✅ Aprobado</option>
                </select>
              </div>

              {showCorrecciones && (
                <div>
                  <label className="block font-semibold mb-1">Notas para correcciones:</label>
                  <textarea
                    className="w-full p-2 border rounded resize-y"
                    rows={4}
                    value={localNotas}
                    onChange={(e) => setLocalNotas(e.target.value)}
                    placeholder="Escribe las correcciones necesarias..."
                    aria-label="Notas para correcciones"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-6 mt-4">
              {/* Botón reemplazar */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  title="Reemplazar vídeo"
                >
                  <Replace className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleArchivoChange}
                  className="hidden"
                />
                {nuevoArchivo && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {nuevoArchivo.name}
                  </span>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => video && onDelete(video.firebaseId)}
                  title="Eliminar vídeo"
                >
                  <Trash className="w-4 h-4" />
                </Button>
                <Button onClick={handleGuardar} title="Guardar cambios">
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
