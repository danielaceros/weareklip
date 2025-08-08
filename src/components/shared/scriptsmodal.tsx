"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"
import { handleError, showSuccess, showLoading } from "@/lib/errors"
import { logAction } from "@/lib/logs"
import { auth } from "@/lib/firebase"
import toast from "react-hot-toast"
import { useTranslations } from "next-intl"

interface Guion {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
  notas?: string
  createdAt?: string
}

interface ScriptEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guion: Guion
  onSave: (updatedGuion: Guion) => void
}

export default function ScriptEditorModal({
  open,
  onOpenChange,
  guion,
  onSave,
}: ScriptEditorModalProps) {
  const t = useTranslations("scriptsModal")
  const tStatus = useTranslations("status")

  const [titulo, setTitulo] = useState(guion.titulo)
  const [contenido, setContenido] = useState(guion.contenido)
  const [estado, setEstado] = useState(String(guion.estado))
  const [notas, setNotas] = useState(guion.notas ?? "")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitulo(guion.titulo)
      setContenido(guion.contenido)
      setEstado(String(guion.estado))
      setNotas(guion.notas ?? "")
    }
  }, [guion, open])

  const handleGuardar = async () => {
    setIsSaving(true)
    const loadingToast = showLoading(t("loading"))

    const updatedGuion: Guion = {
      ...guion,
      titulo,
      contenido,
      estado: parseInt(estado, 10),
      notas: estado === "1" ? notas : "",
    }

    const estadoAnterior = guion.estado
    const estadoNuevo = parseInt(estado, 10)

    try {
      // Si se solicitan cambios, creamos la tarea
      if (estado === "1") {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `✏️ ${t("taskDescriptionPrefix")} ${titulo}`,
            }),
          })

          if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Error ${res.status}: ${errorText}`)
          }

          showSuccess(t("taskAssigned"))
        } catch (error) {
          handleError(error, t("assignTaskError"))
        }
      }

      await onSave(updatedGuion)

      // Log solo si cambió el estado
      if (estadoAnterior !== estadoNuevo && auth.currentUser) {
        try {
          let action = ""
          let message = ""

          if (estadoNuevo === 1) {
            action = "cambios_solicitados"
            message = t("log.requestedChanges", {
              user:
                auth.currentUser.email ||
                auth.currentUser.displayName ||
                "Usuario",
              title: titulo,
            })
          } else if (estadoNuevo === 2) {
            action = "aprobado"
            message = t("log.approved", {
              user:
                auth.currentUser.email ||
                auth.currentUser.displayName ||
                "Usuario",
              title: titulo,
            })
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
            })
          }
        } catch (logError) {
          console.error("Error al registrar log:", logError)
        }
      }

      showSuccess(t("saved"))
      onOpenChange(false)
    } catch (error) {
      handleError(error, t("saveError"))
    } finally {
      toast.dismiss(loadingToast)
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("placeholders.title")}
            aria-label={t("a11y.editTitle")}
          />

          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={6}
            placeholder={t("placeholders.content")}
            aria-label={t("a11y.editContent")}
          />

          <div>
            <label className="block text-sm font-medium mb-1">
              {t("statusLabel")}
            </label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger aria-label={t("a11y.selectStatus")}>
                <SelectValue placeholder={t("placeholders.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{tStatus("new")}</SelectItem>
                <SelectItem value="1">{tStatus("changes")}</SelectItem>
                <SelectItem value="2">{tStatus("approved")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {estado === "1" && (
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder={t("placeholders.notes")}
              aria-label={t("a11y.notes")}
            />
          )}

          <Button className="mt-2" onClick={handleGuardar} disabled={isSaving}>
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
