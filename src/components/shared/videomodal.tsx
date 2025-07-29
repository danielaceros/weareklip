"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
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
      // Enviar tarea si está en estado "Cambios"
      if (estado === "1") {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `✏️ Revisar cambios solicitados en video: ${titulo}`,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error ${res.status}: ${errorText}`);
          }

          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            console.log("✅ Tarea asignada/respuesta del backend:", data);
          }
          
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Editar Vídeo</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={titulo}
          onChange={(e) => onTituloChange(e.target.value)}
          placeholder="Título del vídeo"
          aria-label="Editar título del vídeo"
          className="text-lg font-semibold"
        />

        <video
          src={url}
          controls
          className="w-full max-h-[400px] rounded object-contain mt-4"
          preload="metadata"
          aria-label={`Previsualización del vídeo ${titulo}`}
        />

        <div className="flex flex-wrap items-center gap-4 mt-4">
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger aria-label="Selecciona estado" className="w-48">
              <SelectValue placeholder="Selecciona estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">🆕 Nuevo</SelectItem>
              <SelectItem value="1">✏️ Cambios</SelectItem>
              <SelectItem value="2">✅ Aprobado</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? "Descargando..." : "Descargar vídeo"}
          </Button>
        </div>

        {showCorrecciones && (
          <div className="mt-4 w-full">
            <label htmlFor="notas" className="block font-medium mb-1">
              Indica los cambios que deseas o instrucciones al equipo
            </label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => onNotasChange(e.target.value)}
              placeholder="Describe específicamente qué cambios quieres que se hagan"
              rows={4}
              aria-label="Notas para cambios"
            />
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button onClick={onEliminar} variant="destructive">
            🗑 Eliminar vídeo
          </Button>
          <Button 
            onClick={handleGuardar}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "💾 Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}