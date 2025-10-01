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
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateFileSize } from "@/lib/fileLimits";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleUpload: (file: File) => Promise<void>;
  uploading: boolean;
  progress: number;
  children?: React.ReactNode;
}

// Reglas de validación de vídeo
const VIDEO_MAX_WIDTH = 1080;
const VIDEO_MAX_HEIGHT = 1920;
const VIDEO_ASPECT = 9 / 16; // 0.5625
const VIDEO_ASPECT_TOLERANCE = 0.02; // ~2%

export default function UploadClonacionVideoDialog({
  open,
  onOpenChange,
  handleUpload,
  uploading,
  progress,
}: Props) {
  const t = useT();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validAspect, setValidAspect] = useState(false);
  const [validSize, setValidSize] = useState(false);

  // Revocar URL de preview al cambiar o desmontar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Limpiar estado al cerrar modal
  useEffect(() => {
    if (!open) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setFileName(null);
      setValidAspect(false);
      setValidSize(false);
      setAnalyzing(false);
    }
  }, [open, previewUrl]);

  // Leer metadatos de vídeo
  const readVideoMetadata = (f: File) =>
    new Promise<{ width: number; height: number; duration: number; aspect: number }>(
      (resolve, reject) => {
        try {
          const url = URL.createObjectURL(f);
          const video = document.createElement("video");
          video.preload = "metadata";
          video.muted = true;

          const cleanup = () => URL.revokeObjectURL(url);

          video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const duration = Number.isFinite(video.duration)
              ? Math.round(video.duration)
              : 0;
            cleanup();
            resolve({
              width,
              height,
              duration,
              aspect: height > 0 ? width / height : 0,
            });
          };

          video.onerror = () => {
            cleanup();
            reject(new Error("cantRead"));
          };

          video.src = url;
        } catch {
          reject(new Error("cantRead"));
        }
      }
    );

  // Validar archivo seleccionado
  const validateFile = async (f: File) => {
    setAnalyzing(true);

    // 0) Tipo
    if (!f.type || !f.type.startsWith("video/")) {
      setAnalyzing(false);
      setValidAspect(false);
      toast.error(t("upload.errors.notVideo"));
      return;
    }

    // 1) Tamaño
    const MAX_MB = 300;
    const sizeOK = validateFileSize(f, MAX_MB).ok;
    setValidSize(sizeOK);

    // 2) Metadatos + validaciones (vertical 9:16 + resolución)
    try {
      const meta = await readVideoMetadata(f);

      // Debe ser vertical (no horizontal)
      if (meta.width >= meta.height) {
        setValidAspect(false);
        toast.error(t("upload.errors.notVertical"));
        setAnalyzing(false);
        return;
      }

      // Aspect 9:16 con tolerancia
      const diff = Math.abs(meta.aspect - VIDEO_ASPECT);
      if (diff > VIDEO_ASPECT_TOLERANCE) {
        setValidAspect(false);
        toast.error(t("upload.errors.notAspect916"));
        setAnalyzing(false);
        return;
      }

      // Resolución máxima 1080×1920
      if (meta.width > VIDEO_MAX_WIDTH || meta.height > VIDEO_MAX_HEIGHT) {
        setValidAspect(false);
        toast.error(
          t("upload.errors.tooBigResolution", { w: meta.width, h: meta.height })
        );
        setAnalyzing(false);
        return;
      }

      // OK
      setValidAspect(true);
    } catch {
      setValidAspect(false);
      toast.error(t("upload.errors.cantRead"));
    } finally {
      setAnalyzing(false);
    }
  };

  const onSelectFile = (f: File) => {
    // Si no es vídeo, abortamos antes de crear preview
    if (!f.type || !f.type.startsWith("video/")) {
      toast.error(t("upload.errors.notVideo"));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFileName(f.name);
    void validateFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onSelectFile(f);
  };

  const confirmUpload = async () => {
    if (!file || !validAspect || !validSize) return;
    try {
      await handleUpload(file);
      toast.success(t("video.uploadDialog.uploadedToast"));
      onOpenChange(false);
    } catch {
      toast.error(t("video.uploadDialog.uploadErrorToast"));
    }
  };

  const readyToConfirm = !!file && validAspect && validSize && !analyzing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{t("video.uploadDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tutorial */}
          <div className="aspect-video rounded-lg overflow-hidden border border-border">
            <video
              src="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/Tutorial%20grabación.mov?alt=media"
              controls
              preload="metadata"
              playsInline
              autoPlay
              poster="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/video-cover.jpeg?alt=media"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Requisitos */}
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t("video.uploadDialog.requirementsTitle")}</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    validAspect ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                {t("video.uploadDialog.requirements.aspect")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    validSize ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                {t("video.uploadDialog.requirements.size", { mb: 300 })}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t("video.uploadDialog.requirements.background")}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t("video.uploadDialog.requirements.clarity")}
              </li>
            </ul>
          </div>

          {/* Drag & Drop / Preview */}
          {!previewUrl ? (
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t("video.uploadDialog.dropHint")}
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onSelectFile(f);
                }}
                disabled={uploading}
              />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="relative">
                {analyzing && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white"
                    aria-live="polite"
                  >
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {t("video.uploadDialog.analyzing")}
                  </div>
                )}
                <video
                  src={previewUrl}
                  controls
                  className="w-full max-h-80 object-cover"
                />
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground truncate">
                  {fileName}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setFile(null);
                    setPreviewUrl(null);
                    setFileName(null);
                    setValidAspect(false);
                    setValidSize(false);
                  }}
                  disabled={uploading}
                >
                  {t("video.uploadDialog.replace")}
                </Button>
              </div>
            </div>
          )}

          {/* Confirmar subida */}
          {file && (
            <Button
              className="w-full"
              onClick={confirmUpload}
              disabled={!readyToConfirm || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  {t("video.uploadDialog.uploading")}
                </>
              ) : (
                t("video.uploadDialog.upload")
              )}
            </Button>
          )}

          {/* Progreso */}
          {uploading && (
            <div aria-live="polite">
              <Progress value={progress} className="w-full" />
              <p className="text-xs mt-1 text-muted-foreground text-center">
                {t("video.uploadDialog.progress", { value: progress })}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
