"use client";

import { useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/types/video";
import EmptyState from "@/components/shared/EmptyState";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { ProgressReel } from "@/components/shared/ProgressReel"; // 👈 NUEVO

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
  const t = useTranslations("clientVideosSection");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");

  const estados: Record<number, React.ReactNode> = {
    0: <Badge className="bg-red-500 text-white">🆕 {tStatus("new")}</Badge>,
    1: <Badge className="bg-yellow-400 text-black">✏️ {tStatus("changes")}</Badge>,
    2: <Badge className="bg-green-500 text-white">✅ {tStatus("approved")}</Badge>,
  };

  const MAX_MB = 100;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [] },
    maxSize: MAX_MB * 1024 * 1024,
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Rechazados
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        if (error?.code === "file-too-large") {
          toast.error(`❌ ${t("errors.fileTooLarge", { max: MAX_MB })}`);
        } else if (error?.code === "file-invalid-type") {
          toast.error(`❌ ${t("errors.fileInvalidType")}`);
        } else {
          toast.error(`❌ ${t("errors.fileProcess")}`);
        }
        return;
      }

      // Aceptados
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`❌ ${t("errors.fileTooLarge", { max: MAX_MB })}`);
          return;
        }
        setArchivoVideo(file);
        toast.success(`✅ ${t("toasts.fileSelected", { name: file.name })}`);
      }
    },
  });

  const percent = useMemo(
    () => (uploadProgress !== null ? Math.round(uploadProgress) : null),
    [uploadProgress]
  );

  const handleSubmit = () => {
    if (archivoVideo && nuevoTitulo.trim()) {
      onUpload(archivoVideo, nuevoTitulo.trim());
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">🎬 {t("title")}</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button>+ {t("create")}</Button>
          </DialogTrigger>
          <DialogContent>
            <h3 className="font-semibold text-lg mb-2">{t("uploadDialog.title")}</h3>
            <Input
              placeholder={t("placeholders.title")}
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
                  {t("dropzone.placeholder", { max: MAX_MB })}
                </p>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              className="mt-2 w-full"
              disabled={uploadProgress !== null || !nuevoTitulo.trim() || !archivoVideo}
            >
              {percent !== null ? t("uploading", { percent }) : t("upload")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length === 0 ? (
        <EmptyState>
          <p>🎬 {t("empty.title")}</p>
          <p className="mt-2">
            → {t("empty.hint")}{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="hover:bg-black hover:text-white"
            >
              + {t("create")}
            </Button>
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
              aria-label={t("a11y.selectVideo", { title: v.titulo })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(v);
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-base truncate">{v.titulo}</p>
                {v.estado !== undefined ? (
                  estados[v.estado] ?? <Badge variant="secondary">{tCommon("unknown")}</Badge>
                ) : null}
              </div>

              {/* 👇 NUEVO: stepper de progreso del reel (solo lectura) */}
              <ProgressReel estado={v.reelEstado} compact className="mb-2" />

              <video
                controls
                src={v.url}
                className="rounded w-full aspect-[9/16] object-cover"
                preload="metadata"
                aria-label={t("a11y.videoLabel", { title: v.titulo })}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
