"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import toast from "react-hot-toast";

interface VideoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  url: string;
  estado: string;
  notas: string;
  onNotasChange: (val: string) => void;
  onTituloChange: (val: string) => void;
  onEstadoChange: (val: string) => void;
  onDownload: () => Promise<void>;
  onGuardar: () => Promise<void>;
  onEliminar: () => void;
}

export default function VideoEditorModal({
  open,
  onOpenChange,
  titulo,
  url,
  estado,
  notas,
  onNotasChange,
  onTituloChange,
  onEstadoChange,
  onDownload,
  onGuardar,
  onEliminar,
}: VideoEditorModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const showCorrecciones = estado === "1";

  const handleGuardar = async () => {
    setIsSaving(true);
    const loadingToast = showLoading("Guardando video...");
    try {
      if (estado === "1") {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `✏️ Revisar cambios solicitados en video: ${titulo}`,
            }),
          });
          if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) await res.json();
          showSuccess("Tarea asignada para revisión de cambios");
        } catch (error) {
          handleError(error, "Error al asignar tarea");
        }
      }
      await onGuardar();
      showSuccess("Video guardado con éxito");
    } catch (error) {
      handleError(error, "Error al guardar el video");
    } finally {
      toast.dismiss(loadingToast);
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    const loadingToast = showLoading("Descargando video...");
    try {
      await onDownload();
      showSuccess("Video descargado con éxito");
    } catch (error) {
      handleError(error, "Error al descargar el video");
    } finally {
      toast.dismiss(loadingToast);
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-[37vw] h-[80vh] p-6 flex flex-col gap-6">
        <div className="flex h-full gap-6">
          <div className="flex-1 flex justify-center items-center bg-black rounded-lg overflow-hidden">
            <video
              controls
              src={url}
              className="aspect-[9/16] h-full object-cover rounded-lg"
              preload="metadata"
              aria-label={`Previsualización del vídeo ${titulo}`}
            />
          </div>

          <div className="w-[340px] bg-white rounded-lg p-4 flex flex-col justify-between border shadow-sm">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <DialogTitle className="text-xl font-semibold mb-2">Editar Vídeo</DialogTitle>
              <Input
                type="text"
                value={titulo}
                onChange={(e) => onTituloChange(e.target.value)}
                placeholder="Título del vídeo"
                aria-label="Editar título del vídeo"
              />

              <div>
                <label className="font-semibold block mb-1">Estado:</label>
                <Select value={estado} onValueChange={onEstadoChange}>
                  <SelectTrigger className="w-full" aria-label="Selecciona estado">
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">🆕 Nuevo</SelectItem>
                    <SelectItem value="1">✏️ Cambios</SelectItem>
                    <SelectItem value="2">✅ Aprobado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showCorrecciones && (
                <div>
                  <label className="block font-semibold mb-1">Notas para correcciones:</label>
                  <Textarea
                    id="notas"
                    value={notas}
                    onChange={(e) => onNotasChange(e.target.value)}
                    placeholder="Describe los cambios deseados"
                    rows={4}
                    aria-label="Notas para cambios"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 pt-6">
              <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? "Descargando..." : "Descargar vídeo"}
              </Button>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={onEliminar} className="flex-1">
                  🗑 Eliminar vídeo
                </Button>
                <Button onClick={handleGuardar} disabled={isSaving} className="flex-1">
                  {isSaving ? "Guardando..." : "💾 Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
