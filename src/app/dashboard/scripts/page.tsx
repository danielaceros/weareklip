// src/app/dashboard/scripts/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  type CollectionReference,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useT, type Locale } from "@/lib/i18n";
import { useLocale } from "next-intl";
import { handleError, showLoading, showSuccess } from "@/lib/errors";
import ScriptEditorModal from "@/components/shared/ScriptEditorModal";

// UI para el duplicado
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Guion = {
  firebaseId: string;   // 👈 siempre esta
  titulo: string;
  contenido: string;
  estado: number;
  notas?: string;
  creadoEn?: string;
  lang?: Locale;
};

// Firestore document shape (para tipar el getDocs)
type GuionDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;
  creadoEn?: string;
  notas?: string;
  lang?: Locale;
};

export default function ScriptsPage() {
  const t = useT();
  const locale = useLocale();
  const currentLang: Locale =
    locale === "en" || locale === "fr" ? locale : "es";

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<Guion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Guion | null>(null);

  // Estado del diálogo de duplicado
  const [dupOpen, setDupOpen] = useState(false);
  const [dupTarget, setDupTarget] = useState<Locale>("es");
  const [duplicating, setDuplicating] = useState(false);

  // Cargar guiones
  const loadScripts = useCallback(
    async (uid: string) => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("No autenticado");

        // 🚀 Pedimos a tu API CRUD
        const res = await fetch(`/api/users/${uid}/guiones?order=desc`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) throw new Error("Error al cargar guiones");

        const docs: Guion[] = await res.json();

        const list: Guion[] = docs.map((d: any) => ({
          firebaseId: d.id, // 👈 mapeamos `id` → `firebaseId`
          titulo: d.titulo ?? t("scripts.untitled"),
          contenido: d.contenido ?? "",
          estado: d.estado ?? 0,
          creadoEn: d.creadoEn,
          notas: d.notas,
          lang: d.lang,
        }));

        setScripts(list);
      } catch (err) {
        handleError(err, t("scriptsPage.errors.load"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );


  // Auth + carga
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }
      loadScripts(u.uid);
    });
    return () => unsub();
  }, [loadScripts]);

  const getEstadoBadge = (estado: number) => {
    switch (estado) {
      case 0:
        return (
          <Badge className="bg-red-500 text-white">{t("status.new")}</Badge>
        );
      case 1:
        return (
          <Badge className="bg-yellow-400 text-black">
            {t("status.changes")}
          </Badge>
        );
      case 2:
        return (
          <Badge className="bg-green-500 text-white">
            {t("status.approved")}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{t("common.unknown")}</Badge>;
    }
  };

  // Guardar cambios desde el modal: actualiza Firestore e inmediato en estado local
  const handleSave = async (updated: Guion) => {
    if (!user) return;

    const loadingToast = showLoading(t("scriptsPage.update.loading"));
    try {
      const idToken = await user.getIdToken(); // 🔐 auth para la API

      const res = await fetch(
        `/api/firebase/users/${user.uid}/scripts/${updated.firebaseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            titulo: updated.titulo,
            contenido: updated.contenido,
            estado: updated.estado,
            notas: updated.notas ?? "",
            lang: updated.lang ?? currentLang,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const saved = (await res.json()) as Guion;

      // 🔹 Actualizamos lista local con respuesta de la API
      setScripts((prev) =>
        prev.map((g) =>
          g.firebaseId === updated.firebaseId ? { ...g, ...saved } : g
        )
      );

      showSuccess(t("scriptsPage.update.success"));
    } catch (err) {
      console.error("❌ Error actualizando guion:", err);
      handleError(err, t("scriptsPage.errors.save"));
    } finally {
      toast.dismiss(loadingToast);
    }
  };


  // === Duplicar guion en otro idioma ===
  const openDuplicateDialog = (g: Guion) => {
    setSelected(g);
    // default: idioma distinto al actual si podemos
    const current = g.lang ?? currentLang;
    setDupTarget(current === "es" ? "en" : "es");
    setDupOpen(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!user || !selected) return;
    if (!dupTarget) return;

    try {
      setDuplicating(true);

      const colRef = collection(
        db,
        "users",
        user.uid,
        "guiones"
      ) as CollectionReference<GuionDoc>;

      // FUTURO: aquí puedes llamar a GPT/DeepL para traducir/generar
      // const newContent = await translateOrRegenerate(selected.contenido, dupTarget)
      const newContent = selected.contenido; // por ahora: copia 1:1

      const newDoc = {
        titulo: `${selected.titulo} (${dupTarget.toUpperCase()})`,
        contenido: newContent,
        estado: 0,
        notas: "",
        creadoEn: new Date().toISOString(),
        lang: dupTarget,
      } satisfies GuionDoc;

      const added = await addDoc(colRef, newDoc);

      // Añadimos a la UI (al principio)
      setScripts((prev) => [
        {
          firebaseId: added.id,
          ...newDoc,
        } as Guion,
        ...prev,
      ]);

      showSuccess("✅ Duplicado en otro idioma");
      setDupOpen(false);
      setSelected(null);
    } catch (err) {
      handleError(err, "No se pudo duplicar el guion");
    } finally {
      setDuplicating(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-muted-foreground">
        {t("scriptsPage.errors.authRequired")}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // helper: opciones de idioma sin el actual
  const langLabel: Record<Locale, string> = { es: "ES", en: "EN", fr: "FR" };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("scriptsPage.title")}</h1>

      {scripts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t("scriptsPage.empty")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((g) => {
            const curr = g.lang ?? currentLang;
            const targets: Locale[] = (["es", "en", "fr"] as Locale[]).filter(
              (x) => x !== curr
            );
            return (
              <Card key={g.firebaseId} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold line-clamp-2">{g.titulo}</h3>
                  {getEstadoBadge(g.estado)}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3">
                  {g.contenido || "—"}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    {(g.lang ?? currentLang).toUpperCase()}
                  </Badge>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(g);
                        setModalOpen(true);
                      }}
                    >
                      {t("scriptsModal.title")}
                    </Button>

                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => openDuplicateDialog(g)}
                      title="Duplicar guion en otro idioma"
                    >
                      🌐 Duplicar
                    </Button>
                  </div>
                </div>

                {/* Diálogo de duplicado por tarjeta (controlado a nivel de página) */}
                {selected?.firebaseId === g.firebaseId && (
                  <Dialog open={dupOpen} onOpenChange={(o) => setDupOpen(o)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>🌐 Duplicar guion</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Selecciona el idioma de destino para crear una copia
                          de <strong>{g.titulo}</strong>.
                        </p>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Idioma destino
                          </label>
                          <Select
                            value={dupTarget}
                            onValueChange={(v) => setDupTarget(v as Locale)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Elige idioma" />
                            </SelectTrigger>
                            <SelectContent>
                              {targets.map((l) => (
                                <SelectItem key={l} value={l}>
                                  {langLabel[l]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setDupOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleConfirmDuplicate}
                            disabled={duplicating}
                          >
                            {duplicating ? "Duplicando..." : "Duplicar"}
                          </Button>
                        </div>

                        {/* TODO futurible:
                            - Checkbox “Generar voz con ElevenLabs”
                            - Toggle “Traducir con IA (GPT/DeepL)” en lugar de copia literal
                         */}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de edición */}
      {selected && (
        <ScriptEditorModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelected(null);
          }}
          guion={selected}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
