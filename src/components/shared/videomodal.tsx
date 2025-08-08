// src/components/shared/videomodal.tsx
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
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface VideoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  url: string;
  estado: string; // "0" | "1" | "2"
  notas: string;
  onNotasChange: (val: string) => void;
  onTituloChange: (val: string) => void;
  onEstadoChange: (val: string) => void;
  onDownload: () => Promise<void>;
  onGuardar: () => Promise<void>;
  onEliminar: () => void;
  videoId?: string;
  estadoAnterior?: string;
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
  videoId,
  estadoAnterior,
}: VideoEditorModalProps) {
  const t = useTranslations("videosModal");
  const ts = useTranslations("status"); // 🟡 usamos etiquetas globales de estado
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const showCorrecciones = estado === "1";

  const handleGuardar = async () => {
    setIsSaving(true);
    const loadingToast = showLoading(t("loading.saving"));

    try {
      // Asignar tarea si hay "Cambios"
      if (estado === "1") {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `${t("taskDescriptionPrefix")} ${titulo}`,
            }),
          });
          if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            await res.json();
          }
          showSuccess(t("taskAssigned"));
        } catch (error) {
          handleError(error, t("errors.assignTask"));
        }
      }

      await onGuardar();

      // (Opcional) Debug/log básico sin duplicar logs del page:
      const estadoCambio = estadoAnterior !== estado;
      if (estadoCambio && auth.currentUser && videoId) {
        // Aquí podrías llamar a logAction si quisieras (lo hace el page.tsx)
        // console.log("Log:", { estadoAnterior, estadoNuevo: estado, videoId });
      }

      showSuccess(t("toasts.saveSuccess"));
    } catch (error) {
      handleError(error, t("errors.save"));
    } finally {
      toast.dismiss(loadingToast);
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    const loadingToast = showLoading(t("loading.downloading"));
    try {
      await onDownload();
      showSuccess(t("toasts.downloadSuccess"));
    } catch (error) {
      handleError(error, t("errors.download"));
    } finally {
      toast.dismiss(loadingToast);
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-[37vw] h-[80vh] p-6 flex flex-col gap-6">
        <div className="flex h-full gap-6">
          {/* Preview */}
          <div className="flex-1 flex justify-center items-center bg-black rounded-lg overflow-hidden">
            <video
              controls
              src={url}
              className="aspect-[9/16] h-full object-cover rounded-lg"
              preload="metadata"
              aria-label={t("a11y.preview", { title: titulo })}
            />
          </div>

          {/* Panel de edición */}
          <div className="w-[340px] bg-card text-card-foreground rounded-lg p-4 flex flex-col justify-between border border-border shadow-sm">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <DialogTitle className="text-xl font-semibold mb-2">
                {t("title")}
              </DialogTitle>

              <Input
                type="text"
                value={titulo}
                onChange={(e) => onTituloChange(e.target.value)}
                placeholder={t("placeholders.title")}
                aria-label={t("a11y.editTitle")}
              />

              <div>
                <label className="font-semibold block mb-1">
                  {t("statusLabel")}
                </label>
                <Select value={estado} onValueChange={onEstadoChange}>
                  <SelectTrigger className="w-full" aria-label={t("a11y.selectStatus")}>
                    <SelectValue placeholder={t("placeholders.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{ts("new")}</SelectItem>
                    <SelectItem value="1">{ts("changes")}</SelectItem>
                    <SelectItem value="2">{ts("approved")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showCorrecciones && (
                <div>
                  <label className="block font-semibold mb-1">
                    {t("placeholders.notesLabel")}
                  </label>
                  <Textarea
                    id="notas"
                    value={notas}
                    onChange={(e) => onNotasChange(e.target.value)}
                    placeholder={t("placeholders.notes")}
                    rows={4}
                    aria-label={t("a11y.notes")}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 pt-6">
              <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? t("actions.downloading") : t("actions.download")}
              </Button>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={onEliminar} className="flex-1">
                  {t("actions.delete")}
                </Button>
                <Button onClick={handleGuardar} disabled={isSaving} className="flex-1">
                  {isSaving ? t("actions.saving") : t("actions.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
