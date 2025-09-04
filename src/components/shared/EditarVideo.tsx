// src/components/shared/editarvideo.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { Video, ReelEstado } from "@/types/video";
import { Replace, Trash, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProgressReel } from "@/components/shared/ProgressReel";

type Props = {
  video: Video | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSave: (video: Video & { nuevoArchivo?: File }) => void;
};

const REEL_STEPS: readonly ReelEstado[] = [
  "Recibido",
  "Guión aprobado",
  "Voz generada",
  "Vídeo creado",
  "Entregado",
] as const;

export default function EditarVideoModal({
  video,
  onClose,
  onDelete,
  onSave,
}: Props) {
  const t = useTranslations("videosModal");
  const tStatus = useTranslations("status");
  const tVideos = useTranslations("videos");

  const [localEstado, setLocalEstado] = useState<number>(video?.estado ?? 0);
  const [localNotas, setLocalNotas] = useState<string>(video?.notas ?? "");
  const [localTitulo, setLocalTitulo] = useState<string>(video?.titulo ?? "");
  const [localReelEstado, setLocalReelEstado] = useState<ReelEstado>(
    video?.reelEstado || "Recibido"
  );

  const [nuevoArchivo, setNuevoArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (video) {
      setLocalEstado(typeof video.estado === "string" ? Number(video.estado) : video.estado);
      setLocalNotas(video.notas ?? "");
      setLocalTitulo(video.titulo ?? "");
      setLocalReelEstado(video.reelEstado || "Recibido");
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
      reelEstado: localReelEstado,
      ...(nuevoArchivo && { nuevoArchivo }),
    });
  };

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSizeMB = 100;
      if (file.size > maxSizeMB * 1024 * 1024) {
        window.alert(t("errors.fileTooLarge", { max: maxSizeMB }));
        return;
      }
      setNuevoArchivo(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  if (!video) return null;

  const showCorrecciones = localEstado === 1;
  const previewTitle = localTitulo?.trim() || tVideos("untitled");

  return (
    <Dialog open={!!video} onOpenChange={onClose}>
      <VisuallyHidden>
        <DialogTitle>{t("title")}</DialogTitle>
      </VisuallyHidden>

      <DialogContent className="w-[95vw] max-w-[1400px] h-[80vh] p-6">
        <div className="grid h-full min-h-0 gap-6 grid-cols-[minmax(320px,1fr)_740px]">
          {/* Vídeo */}
          <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
            <video
              controls
              src={previewUrl || video?.url}
              className="h-full max-h-full w-auto aspect-[9/16] object-contain rounded-lg"
              preload="metadata"
              aria-label={t("a11y.preview", { title: previewTitle })}
            />
          </div>

          {/* Panel derecho */}
          <div className="rounded-lg p-4 flex flex-col justify-between border border-border shadow-sm bg-card text-card-foreground">
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
              <DialogTitle className="text-xl font-semibold mb-2">
                {t("title")}
              </DialogTitle>

              {/* Progreso reel */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {t("progressLabel")}
                </p>
                <ProgressReel estado={localReelEstado} size="narrow" />
                <div>
                  <label className="font-semibold block mb-1">
                    {t("productionStatus")}
                  </label>
                  <select
                    className="p-2 border rounded w-full bg-background text-foreground"
                    value={localReelEstado}
                    onChange={(e) =>
                      setLocalReelEstado(e.target.value as ReelEstado)
                    }
                  >
                    {REEL_STEPS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={localTitulo}
                onChange={(e) => setLocalTitulo(e.target.value)}
                className="p-2 border rounded w-full bg-background text-foreground"
                placeholder={t("placeholders.title")}
                aria-label={t("a11y.editTitle")}
              />

              <div>
                <label className="font-semibold block mb-1">
                  {t("statusLabel")}
                </label>
                <select
                  className="p-2 border rounded w-full bg-background text-foreground"
                  value={localEstado}
                  onChange={(e) => setLocalEstado(Number(e.target.value))}
                  aria-label={t("a11y.selectStatus")}
                >
                  <option value={0}>🆕 {tStatus("new")}</option>
                  <option value={1}>✏️ {tStatus("changes")}</option>
                  <option value={2}>✅ {tStatus("approved")}</option>
                </select>
              </div>

              {showCorrecciones && (
                <div>
                  <label className="block font-semibold mb-1">
                    {t("placeholders.notesLabel")}
                  </label>
                  <textarea
                    className="w-full p-2 border rounded resize-y bg-background text-foreground"
                    rows={4}
                    value={localNotas}
                    onChange={(e) => setLocalNotas(e.target.value)}
                    placeholder={t("placeholders.notes")}
                    aria-label={t("a11y.notes")}
                  />
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-4 pt-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  title={t("actions.replace")}
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
                  <span className="text-xs text-muted-foreground truncate">
                    {nuevoArchivo.name}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => video && onDelete(video.firebaseId)}
                  title={t("actions.delete")}
                  className="flex-1"
                >
                  <Trash className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleGuardar}
                  title={t("actions.save")}
                  className="flex-1"
                >
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

