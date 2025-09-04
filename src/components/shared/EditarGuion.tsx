// src/components/shared/editarguion.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type Guion = {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
  notas?: string;
};

type Props = {
  guion: Guion | null;
  onClose: () => void;
  onChange: (guion: Guion) => void;
  onDelete: (id: string) => void;
  onSave: () => Promise<void>;
};

export default function EditarGuionModal({
  guion,
  onClose,
  onChange,
  onDelete,
  onSave,
}: Props) {
  const t = useTranslations("scriptsModal");
  const tStatus = useTranslations("status");
  const tScripts = useTranslations("scripts");

  const [estadoAnterior, setEstadoAnterior] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (guion) setEstadoAnterior(guion.estado);
  }, [guion]);

  const handleInputChange = (field: keyof Guion, value: string | number) => {
    if (guion) onChange({ ...guion, [field]: value });
  };

  const handleEstadoChange = (value: string) => {
    const nuevoEstado = parseInt(value, 10);
    handleInputChange("estado", nuevoEstado);
  };

  const asignarTareasAdmin = async () => {
    if (!guion) return;
    const res = await fetch("/api/assign-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: guion.titulo }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "assign-task failed");
    }
    return res.json();
  };

  const handleSave = async () => {
    if (!guion) return;
    setGuardando(true);
    try {
      await onSave();

      if (guion.estado === 1 && estadoAnterior !== 1) {
        await asignarTareasAdmin();
        toast.success(t("taskAssigned"));
      }

      setEstadoAnterior(guion.estado);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error guardando guion:", error);
      toast.error(t("saveError"));
    } finally {
      setGuardando(false);
    }
  };

  if (!guion) return null;

  return (
    <Dialog
      open={!!guion}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="space-y-4">
        <VisuallyHidden>
          <DialogTitle>{t("title")}</DialogTitle>
        </VisuallyHidden>

        <Input
          value={guion.titulo}
          onChange={(e) => handleInputChange("titulo", e.target.value)}
          placeholder={t("placeholders.title")}
          aria-label={t("a11y.editTitle")}
          disabled={guardando}
        />

        <Textarea
          value={guion.contenido}
          onChange={(e) => handleInputChange("contenido", e.target.value)}
          placeholder={t("placeholders.content")}
          aria-label={t("a11y.editContent")}
          disabled={guardando}
        />

        <Select
          value={String(guion.estado)}
          onValueChange={handleEstadoChange}
          disabled={guardando}
        >
          <SelectTrigger aria-label={t("a11y.selectStatus")}>
            <SelectValue placeholder={t("placeholders.selectStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">🆕 {tStatus("new")}</SelectItem>
            <SelectItem value="1">✏️ {tStatus("changes")}</SelectItem>
            <SelectItem value="2">✅ {tStatus("approved")}</SelectItem>
          </SelectContent>
        </Select>

        {guion.estado === 1 && (
          <Textarea
            className="mt-2"
            value={guion.notas || ""}
            onChange={(e) => handleInputChange("notas", e.target.value)}
            placeholder={t("placeholders.notes")}
            aria-label={t("a11y.notes")}
            rows={4}
            disabled={guardando}
          />
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDelete(guion.firebaseId)}
            disabled={guardando}
          >
            {tScripts("actions.delete")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={guardando}
          >
            {guardando ? t("saving") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

