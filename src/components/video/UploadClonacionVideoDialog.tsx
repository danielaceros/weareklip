"use client";

import { useState, useEffect, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { validateFileSize } from "@/lib/fileLimits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleUpload: (file: File) => Promise<void>; // 🔹 mejor async
  uploading: boolean;
  progress: number;
}

export default function UploadClonacionVideoDialog({
  open,
  onOpenChange,
  handleUpload,
  uploading,
  progress,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // 🔄 limpiar estados al cerrar modal
  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setFileName(null);
    }
  }, [open]);

  const optimisticUpload = async (file: File) => {
    const res = validateFileSize(file, 200); // límite 200 MB
    if (!res.ok) {
      toast.error("Archivo demasiado grande", { description: res.message });
      return;
    }

    // 👉 Optimistic UI: preview inmediata
    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);
    setFileName(file.name);

    try {
      await handleUpload(file);
      toast.success("✅ Vídeo subido correctamente");
    } catch (err) {
      console.error("❌ Error al subir:", err);
      toast.error("No se pudo subir el vídeo");
      setPreviewUrl(null); // 🔙 rollback
      setFileName(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) optimisticUpload(file);
  };

  const onFileSelect = (file: File) => {
    optimisticUpload(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Subir vídeo de clonación</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tutorial */}
          <div className="aspect-video rounded-lg overflow-hidden border border-border">
            <video
              src="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/Tutorial%20grabación.mov?alt=media"
              controls
              preload="metadata"
              playsInline
              poster="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/video-cover.jpeg?alt=media"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Checklist de requisitos */}
          <div className="space-y-2 text-sm">
            <p className="font-medium">Requisitos del vídeo:</p>
            <ul className="space-y-1">
              {[
                "Formato vertical (9:16)",
                "Máximo 200 MB",
                "Fondo liso y buena iluminación",
                "Hablar de frente y con claridad",
              ].map((req) => (
                <li key={req} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Drag & Drop / Preview */}
          {!previewUrl ? (
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">
                Arrastra tu vídeo aquí o haz click para seleccionarlo
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelect(file);
                }}
                disabled={uploading}
              />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <video src={previewUrl} controls className="w-full max-h-80 object-cover" />
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground truncate">
                  {uploading ? "Subiendo…" : fileName || "Vídeo listo"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewUrl(null);
                    setFileName(null);
                  }}
                  disabled={uploading}
                >
                  Reemplazar
                </Button>
              </div>
            </div>
          )}

          {/* Progreso */}
          {uploading && (
            <div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs mt-1 text-muted-foreground text-center">
                {progress}% subido
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
