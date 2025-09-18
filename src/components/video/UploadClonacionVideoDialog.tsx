// src/components/video/UploadClonacionVideoDialog.tsx
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

const MAX_W = 1080;
const MAX_H = 1920;
const ASPECT = 9 / 16;
const TOL = 0.01; // ±1%

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
  const [validResolution, setValidResolution] = useState(false);

  // Limpiar estado al cerrar modal
  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setFileName(null);
      setValidAspect(false);
      setValidSize(false);
      setValidResolution(false);
      setAnalyzing(false);
    }
  }, [open]);

  // Validar archivo
  const validateFile = async (f: File) => {
    setAnalyzing(true);

    // tamaño (MB)
    const sizeOK = validateFileSize(f, 300).ok;
    setValidSize(sizeOK);
    if (!sizeOK) {
      toast.error(t("userPage.clonacion.upload.maxSize", { max: 300 }));
    }

    // aspecto + resolución
    const url = URL.createObjectURL(f);
    const video = document.createElement("video");
    video.src = url;
    video.preload = "metadata";

    return new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;

        // vertical
        if (h <= w) {
          setValidAspect(false);
          toast.error(t("userPage.clonacion.upload.notVertical"));
        } else {
          const ratio = w / h;
          const is916 = Math.abs(ratio - ASPECT) <= TOL;
          setValidAspect(is916);
          if (!is916) {
            toast.error(t("userPage.clonacion.upload.notAspect916"));
          }
        }

        // resolución máxima
        const resOK = w <= MAX_W && h <= MAX_H;
        setValidResolution(resOK);
        if (!resOK) {
          toast.error(
            t("userPage.clonacion.upload.tooBigResolution", { w, h, maxW: MAX_W, maxH: MAX_H })
          );
        }

        setAnalyzing(false);
        URL.revokeObjectURL(url);
        resolve();
      };
      video.onerror = () => {
        setValidAspect(false);
        setValidResolution(false);
        setAnalyzing(false);
        toast.error(t("userPage.clonacion.upload.cantRead"));
        URL.revokeObjectURL(url);
        resolve();
      };
    });
  };

  const onSelectFile = (f: File) => {
    if (!f.type?.startsWith("video/")) {
      toast.error(t("userPage.clonacion.upload.onlyVideos"));
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setFileName(f.name);
    void validateFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onSelectFile(f);
  };

  const confirmUpload = async () => {
    if (!file || !validAspect || !validSize || !validResolution) return;
    try {
      await handleUpload(file);
      toast.success(t("userPage.clonacion.upload.success", { name: file.name }));
      onOpenChange(false);
    } catch {
      toast.error(t("userPage.clonacion.upload.uploadError", { name: file?.name ?? "" }));
    }
  };

  const readyToConfirm = !!file && validAspect && validSize && validResolution && !analyzing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{t("userPage.clonacion.uploadDialogTitle")}</DialogTitle>
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
            <p className="font-medium">{t("userPage.clonacion.requirementsTitle")}</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    validAspect ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                {t("userPage.clonacion.requirements.vertical916")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    validResolution ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                {t("userPage.clonacion.requirements.maxResolution", {
                  maxW: MAX_W,
                  maxH: MAX_H,
                })}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    validSize ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                {t("userPage.clonacion.upload.maxSize", { max: 300 })}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t("userPage.clonacion.requirements.cleanBg")}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t("userPage.clonacion.requirements.faceFront")}
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
                {t("userPage.clonacion.upload.dragOrClick")}
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {t("userPage.clonacion.upload.analyzing")}
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
                    setValidAspect(false);
                    setValidResolution(false);
                    setValidSize(false);
                  }}
                  disabled={uploading}
                >
                  {t("userPage.clonacion.upload.replace")}
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
                  {t("userPage.clonacion.upload.uploading")}
                </>
              ) : (
                t("userPage.clonacion.upload.upload")
              )}
            </Button>
          )}

          {/* Progreso */}
          {uploading && (
            <div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs mt-1 text-muted-foreground text-center">
                {t("userPage.clonacion.upload.progressLabel", { percent: progress })}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
