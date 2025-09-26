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

  // Limpiar estado al cerrar modal
  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setFileName(null);
      setValidAspect(false);
      setValidSize(false);
      setAnalyzing(false);
    }
  }, [open]);

  // Validar archivo
  const validateFile = async (f: File) => {
    setAnalyzing(true);
    const MAX_MB = 300;
    const sizeOK = validateFileSize(f, MAX_MB).ok;
    setValidSize(sizeOK);

    // validar aspecto
    const url = URL.createObjectURL(f);
    const video = document.createElement("video");
    video.src = url;
    video.preload = "metadata";

    return new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        const is916 = Math.abs(ratio - 9 / 16) < 0.05;
        setValidAspect(is916);
        setAnalyzing(false);
        URL.revokeObjectURL(url);
        resolve();
      };
      video.onerror = () => {
        setValidAspect(false);
        setAnalyzing(false);
        URL.revokeObjectURL(url);
        resolve();
      };
    });
  };

  const onSelectFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setFileName(f.name);
    validateFile(f);
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

  const readyToConfirm = file && validAspect && validSize && !analyzing;

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
                    setFile(null);
                    setPreviewUrl(null);
                    setFileName(null);
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
