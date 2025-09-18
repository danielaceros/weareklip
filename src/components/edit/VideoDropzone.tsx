// src/components/edit/VideoDropzone.tsx
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, VideoIcon } from "lucide-react";
import { toast } from "sonner";              // ✅ importar desde 'sonner'
import { useT } from "@/lib/i18n";

interface Props {
  file: File | null;
  setFile: (file: File | null) => void;
  videoUrl: string | null;
  setVideoUrl: (url: string | null) => void;
}

// Reglas de validación vídeo: vertical 9:16 y máx. 1080×1920
const MAX_W = 1080;
const MAX_H = 1920;
const ASPECT = 9 / 16;
const TOL = 0.01; // ±1% de tolerancia

async function readVideoDims(file: File): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        URL.revokeObjectURL(url);
        if (w && h) resolve({ w, h });
        else reject(new Error("cantRead"));
      };
      video.onerror = () => reject(new Error("cantRead"));
      video.src = url;
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function VideoDropzone({ file, setFile, videoUrl, setVideoUrl }: Props) {
  const t = useT();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles?.[0];
      if (!f) return;

      if (!f.type?.startsWith("video/")) {
        toast.error(t("upload.errors.notVideo"));
        return;
      }

      try {
        const { w, h } = await readVideoDims(f);

        if (h <= w) {
          toast.error(t("upload.errors.notVertical"));
          return;
        }

        const ratio = w / h;
        if (Math.abs(ratio - ASPECT) > TOL) {
          toast.error(t("upload.errors.notAspect916"));
          return;
        }

        if (w > MAX_W || h > MAX_H) {
          toast.error(t("upload.errors.tooBigResolution", { w, h }));
          return;
        }

        // OK: pasa validación
        setFile(f);
        setVideoUrl(null);
      } catch {
        toast.error(t("upload.errors.cantRead"));
      }
    },
    [t, setFile, setVideoUrl]
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
            {isDragActive ? t("ui.dropzone.dropHere") : t("ui.dropzone.dragOrClick")}
          </p>
        </>
      )}
    </div>
  );
}
