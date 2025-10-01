// src/app/dashboard/edit/VideoDropzone.tsx
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, VideoIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

interface Props {
  file: File | null;
  setFile: (file: File | null) => void;
  videoUrl: string | null;
  setVideoUrl: (url: string | null) => void;
}

// Límites y validación (solo en este archivo)
const VIDEO_MAX_WIDTH = 1080;
const VIDEO_MAX_HEIGHT = 1920;
const VIDEO_ASPECT = 9 / 16; // 0.5625
const VIDEO_ASPECT_TOLERANCE = 0.02; // ~2%

type VideoMeta = {
  width: number;
  height: number;
  duration: number;
  aspect: number;
};

function readVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
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
  });
}

export function VideoDropzone({ file, setFile, videoUrl, setVideoUrl }: Props) {
  const t = useT();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles?.[0];
      if (!f) return;

      // 0) Tipo de archivo
      if (!f.type || !f.type.startsWith("video/")) {
        toast.error(t("upload.errors.notVideo"));
        return;
      }

      // 1) Leer metadatos
      let meta: VideoMeta;
      try {
        meta = await readVideoMetadata(f);
      } catch {
        toast.error(t("upload.errors.cantRead"));
        return;
      }

      // 2) Validar vertical
      if (meta.width >= meta.height) {
        toast.error(t("upload.errors.notVertical"));
        return;
      }

      // 3) Validar aspect 9:16 con tolerancia
      const diff = Math.abs(meta.aspect - VIDEO_ASPECT);
      if (diff > VIDEO_ASPECT_TOLERANCE) {
        toast.error(t("upload.errors.notAspect916"));
        return;
      }

      // 4) Validar resolución máxima 1080×1920
      if (meta.width > VIDEO_MAX_WIDTH || meta.height > VIDEO_MAX_HEIGHT) {
        toast.error(
          t("upload.errors.tooBigResolution", {
            w: meta.width,
            h: meta.height,
          })
        );
        return;
      }

      // ✅ OK → guardar selección
      setFile(f);
      setVideoUrl(null);
    },
    [setFile, setVideoUrl, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
  });

  if (videoUrl) {
    return (
      <div className="rounded-xl overflow-hidden border w-full aspect-[9/16]">
        <video src={videoUrl} controls className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer w-full aspect-[9/16] transition ${
        isDragActive ? "border-primary bg-muted" : "border-muted-foreground/50"
      }`}
    >
      <input {...getInputProps()} />
      {file ? (
        <>
          <VideoIcon className="w-10 h-10 mb-2 text-primary" />
          <p className="text-sm font-medium text-center">{file.name}</p>
        </>
      ) : (
        <>
          <UploadCloud className="w-10 h-10 mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {isDragActive
              ? t("edit.create.dropzone.active")
              : t("edit.create.dropzone.idle")}
          </p>
        </>
      )}
    </div>
  );
}
