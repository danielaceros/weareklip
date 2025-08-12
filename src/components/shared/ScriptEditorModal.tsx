"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
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
import { useState, useEffect } from "react";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import { logAction } from "@/lib/logs";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useLocale } from "next-intl";
import { useT, LOCALES, type Locale } from "@/lib/i18n";
import { createGuion } from "@/lib/scripts";
import Comments from "@/components/shared/Comments";

interface Guion {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
  notas?: string;
  createdAt?: string;
  lang?: Locale;
}

interface ScriptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guion: Guion;
  onSave: (updatedGuion: Guion) => void;
}

export default function ScriptEditorModal({
  open,
  onOpenChange,
  guion,
  onSave,
}: ScriptEditorModalProps) {
  const t = useT();
  const locale = useLocale(); // 'es' | 'en' | 'fr' | otros
  const currentLang: Locale =
    locale === "en" || locale === "fr" ? locale : "es";

  // Fallback translator for new keys (so we don't break if JSON doesn't have them yet)
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const [titulo, setTitulo] = useState(guion.titulo);
  const [contenido, setContenido] = useState(guion.contenido);
  const [estado, setEstado] = useState(String(guion.estado));
  const [notas, setNotas] = useState(guion.notas ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate-to-language UI
  const allLocales = Object.keys(LOCALES) as Locale[];
  const targetOptions = allLocales.filter((l) => l !== currentLang);
  const [dupLang, setDupLang] = useState<Locale>(targetOptions[0] ?? "en");
  const [isDuplicating, setIsDuplicating] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo(guion.titulo);
      setContenido(guion.contenido);
      setEstado(String(guion.estado));
      setNotas(guion.notas ?? "");
      // si cambia el modal, reajusta el idioma de destino si coincide con el actual
      if (dupLang === currentLang && targetOptions.length > 0) {
        setDupLang(targetOptions[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, open, currentLang]);

  const handleGuardar = async () => {
    setIsSaving(true);
    const loadingToast = showLoading(t("scriptsModal.loading"));

    const updatedGuion: Guion = {
      ...guion,
      titulo,
      contenido,
      estado: parseInt(estado, 10),
      notas: estado === "1" ? notas : "",
      // guardamos/actualizamos siempre el idioma del guion
      lang: currentLang,
    };

    const estadoAnterior = guion.estado;
    const estadoNuevo = parseInt(estado, 10);

    try {
      // Si se solicitan cambios, creamos la tarea
      if (estado === "1") {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `✏️ ${t("scriptsModal.taskDescriptionPrefix")} ${titulo}`,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error ${res.status}: ${errorText}`);
          }

          showSuccess(t("scriptsModal.taskAssigned"));
        } catch (error) {
          handleError(error, t("scriptsModal.errors.assignTask"));
        }
      }

      await onSave(updatedGuion);

      // Log solo si cambió el estado
      if (estadoAnterior !== estadoNuevo && auth.currentUser) {
        try {
          let action = "";
          let message = "";

          if (estadoNuevo === 1) {
            action = "cambios_solicitados";
            message = t("scriptsModal.log.requestedChanges", {
              user:
                auth.currentUser.email ||
                auth.currentUser.displayName ||
                "Usuario",
              title: titulo,
            });
          } else if (estadoNuevo === 2) {
            action = "aprobado";
            message = t("scriptsModal.log.approved", {
              user:
                auth.currentUser.email ||
                auth.currentUser.displayName ||
                "Usuario",
              title: titulo,
            });
          }

          if (action && message) {
            await logAction({
              type: "guion",
              action,
              uid: auth.currentUser.uid,
              admin:
                auth.currentUser.email ||
                auth.currentUser.displayName ||
                "Cliente",
              targetId: guion.firebaseId,
              message,
            });
          }
        } catch (logError) {
          console.error("Error al registrar log:", logError);
        }
      }

      showSuccess(t("scriptsModal.saved"));
      onOpenChange(false);
    } catch (error) {
      handleError(error, t("scriptsModal.saveError"));
    } finally {
      toast.dismiss(loadingToast);
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!auth.currentUser) return;
    setIsDuplicating(true);
    const loadingToast = showLoading(
      tf("scriptsModal.duplicating", "Duplicando guion...")
    );
    try {
      await createGuion(
        auth.currentUser.uid,
        {
          titulo: titulo,
          contenido: contenido,
          estado: 0, // nuevo
        },
        dupLang
      );
      showSuccess(
        tf(
          "scriptsModal.duplicateSuccess",
          "Guion duplicado correctamente"
        )
      );
    } catch (err) {
      handleError(
        err,
        tf(
          "scriptsModal.duplicateError",
          "Error al duplicar el guion"
        )
      );
    } finally {
      toast.dismiss(loadingToast);
      setIsDuplicating(false);
    }
  };

  // --- Comentarios: docPath para users/{uid}/guiones/{guionId}
  const commentsDocPath =
    auth.currentUser?.uid && guion?.firebaseId
      ? `users/${auth.currentUser.uid}/guiones/${guion.firebaseId}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("scriptsModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("scriptsModal.placeholders.title")}
            aria-label={t("scriptsModal.a11y.editTitle")}
          />

          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={6}
            placeholder={t("scriptsModal.placeholders.content")}
            aria-label={t("scriptsModal.a11y.editContent")}
          />

          <div>
            <label className="block text-sm font-medium mb-1">
              {t("scriptsModal.statusLabel")}
            </label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger aria-label={t("scriptsModal.a11y.selectStatus")}>
                <SelectValue
                  placeholder={t("scriptsModal.placeholders.selectStatus")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("status.new")}</SelectItem>
                <SelectItem value="1">{t("status.changes")}</SelectItem>
                <SelectItem value="2">{t("status.approved")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {estado === "1" && (
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder={t("scriptsModal.placeholders.notes")}
              aria-label={t("scriptsModal.a11y.notes")}
            />
          )}

          <Button className="mt-2" onClick={handleGuardar} disabled={isSaving}>
            {isSaving ? t("scriptsModal.saving") : t("scriptsModal.save")}
          </Button>

          {/* ====== Comentarios (tipo Notion) ====== */}
          {commentsDocPath && (
            <div className="mt-4 border-t pt-4 space-y-2">
              <p className="text-sm font-medium">
                {tf("scriptsModal.commentsLabel", "💬 Comentarios")}
              </p>
              <Comments docPath={commentsDocPath} />
            </div>
          )}
          {/* ====================================== */}

          {/* ====== Duplicar en otro idioma (opcional) ====== */}
          <div className="mt-4 border-t pt-4 space-y-2">
            <p className="text-sm font-medium">
              {tf(
                "scriptsModal.duplicateLabel",
                "🌐 Duplicar en otro idioma (opcional)"
              )}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={dupLang}
                onValueChange={(v) => setDupLang(v as Locale)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue
                    placeholder={tf(
                      "scriptsModal.selectLanguage",
                      "Selecciona idioma"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {LOCALES[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleDuplicate} disabled={isDuplicating}>
                {isDuplicating
                  ? tf("scriptsModal.duplicating", "Duplicando guion...")
                  : tf("scriptsModal.duplicate", "Duplicar")}
              </Button>
            </div>
          </div>
          {/* ================================================ */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
