"use client";

import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { ScriptForm } from "./ScriptForm";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

// ✅ i18n
import { useT } from "@/lib/i18n";

/* Opciones (alineadas con ScriptForm) */
const TONE_OPTIONS = [
  "Motivador",
  "Educativo",
  "Humorístico",
  "Serio",
  "Inspirador",
  "Emocional",
  "Provocador",
];

const STRUCTURE_OPTIONS = [
  "Gancho – Desarrollo – Cierre",
  "Storytelling",
  "Lista de tips",
  "Pregunta retórica",
  "Comparativa antes/después",
  "Mito vs realidad",
  "Problema – Solución",
  "Testimonio",
];

interface ScriptCreatorContainerProps {
  onClose?: () => void;
  onCreated?: (newScript: any) => void;
}

export default function ScriptCreatorContainer({
  onClose,
  onCreated,
}: ScriptCreatorContainerProps) {
  const t = useT();

  const [user, setUser] = useState<User | null>(null);

  // Campos del formulario
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");

  // Script generado / modal secundario
  const [script, setScript] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [scriptRegens, setScriptRegens] = useState(0);

  // Mini-diálogo para regeneración
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenTone, setRegenTone] = useState("");
  const [regenStructure, setRegenStructure] = useState("");

  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const router = useRouter();

  // 🔑 Autenticación
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 🚀 Generar script
  const handleGenerate = useCallback(async () => {
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error(t("scriptsCreator.toasts.fillAll"));
      return;
    }
    if (!user) {
      toast.error(t("scriptsCreator.toasts.mustLogin"));
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      const res = await fetch("/api/chatgpt/scripts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({
          description,
          tone,
          platform,
          duration,
          language,
          structure,
          addCTA,
          ctaText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando guion");

      flushSync(() => {
        setScript(data.script || "");
        setShowModal(true);
      });
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : t("scriptsCreator.toasts.generateError")
      );
    } finally {
      setLoading(false);
    }
  }, [
    description,
    tone,
    platform,
    duration,
    structure,
    language,
    addCTA,
    ctaText,
    user,
    t,
  ]);

  // 🔄 Regenerar script
  const regenerateScript = useCallback(
    async (overrides?: { tone?: string; structure?: string }) => {
      if (scriptRegens >= 2) {
        toast.error(t("scriptsCreator.toasts.regenLimit"));
        return;
      }

      const toneToSend = overrides?.tone ?? tone;
      const structToSend = overrides?.structure ?? structure;

      const loadingId = toast.loading(t("scriptsCreator.toasts.regenerating"));
      try {
        if (!user) throw new Error("No autenticado");
        const idToken = await user.getIdToken();

        const res = await fetch("/api/chatgpt/scripts/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-Idempotency-Key": uuidv4(),
          },
          body: JSON.stringify({
            description,
            tone: toneToSend,
            platform,
            duration,
            language,
            structure: structToSend,
            addCTA,
            ctaText,
          }),
        });

        const parsed = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");

        setScript(parsed.script || "");
        setScriptRegens((c) => c + 1);
        setTone(toneToSend);
        setStructure(structToSend);

        toast.success(
          // Si prefieres contar en el texto, podemos añadir {count} al i18n
          `✅ Guion regenerado (${Math.min(scriptRegens + 1, 2)}/2)`,
          { id: loadingId }
        );
      } catch (err) {
        console.error(err);
        toast.error(t("scriptsCreator.toasts.regenError"), { id: loadingId });
      } finally {
        toast.dismiss(loadingId);
      }
    },
    [
      user,
      scriptRegens,
      description,
      tone,
      platform,
      duration,
      language,
      structure,
      addCTA,
      ctaText,
      t,
    ]
  );

  // 💾 Aceptar y guardar script
  const acceptScript = useCallback(async () => {
    if (!user) return;

    const toastId = toast.loading(t("scriptsCreator.toasts.saving"));

    try {
      const idToken = await user.getIdToken();
      const scriptId = uuidv4();

      const res = await fetch(
        `/api/firebase/users/${user.uid}/scripts/${scriptId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            description,
            tone,
            platform,
            duration,
            language,
            structure,
            addCTA,
            ctaText,
            script,
            createdAt: Date.now(),
            scriptId,
            regenerations: scriptRegens,
            isAI: true,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      toast.success(t("scriptsCreator.toasts.saved"), { id: toastId });

      // 1️⃣ Cerrar modal secundario
      setShowModal(false);

      // 2️⃣ Notificar al padre
      if (typeof onCreated === "function") {
        onCreated({
          scriptId,
          description,
          tone,
          platform,
          duration,
          language,
          structure,
          addCTA,
          ctaText,
          script,
          createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
          regenerations: scriptRegens,
          isAI: true,
        });
      }

      // 3️⃣ Cerrar modal principal
      if (typeof onClose === "function") {
        onClose();
      }

      // 4️⃣ Refrescar/navegar
      if (window.location.pathname === "/dashboard/script") {
        router.refresh();
      } else {
        router.push("/dashboard/script");
      }
    } catch (err) {
      console.error("❌ Error al guardar guion:", err);
      toast.error(t("scriptsCreator.toasts.saveError"), { id: toastId });
    }
  }, [
    user,
    description,
    tone,
    platform,
    duration,
    language,
    structure,
    addCTA,
    ctaText,
    script,
    scriptRegens,
    router,
    onClose,
    onCreated,
    t,
  ]);

  /* Abre el mini-diálogo con los valores actuales */
  const openRegenDialog = () => {
    if (scriptRegens >= 2) {
      toast.error(t("scriptsCreator.toasts.regenLimit"));
      return;
    }
    setRegenTone(tone || TONE_OPTIONS[0]);
    setRegenStructure(structure || STRUCTURE_OPTIONS[0]);
    setRegenDialogOpen(true);
  };

  return (
    <>
      {/* Formulario */}
      <ScriptForm
        description={description}
        tone={tone}
        platform={platform}
        duration={duration}
        language={language}
        structure={structure}
        addCTA={addCTA}
        ctaText={ctaText}
        loading={loading}
        setDescription={setDescription}
        setTone={setTone}
        setPlatform={setPlatform}
        setDuration={setDuration}
        setLanguage={setLanguage}
        setStructure={setStructure}
        setAddCTA={setAddCTA}
        setCtaText={setCtaText}
        onSubmit={handleGenerate}
      />

      {/* Modal guion generado */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("scriptsCreator.dialog.generatedTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[200px] w-full resize-none"
          />
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={openRegenDialog}
              disabled={scriptRegens >= 2}
            >
              {t("scriptsCreator.buttons.regenerate", { count: scriptRegens })}
            </Button>
            <Button onClick={acceptScript}>
              {t("scriptsCreator.buttons.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mini-diálogo para cambiar Tono y Estructura */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("scriptsCreator.regenDialog.title")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">
                {t("scriptsCreator.regenDialog.labels.tone")}
              </div>
              <Select value={regenTone} onValueChange={setRegenTone}>
                <SelectTrigger>
                  <SelectValue placeholder={t("scriptsCreator.regenDialog.placeholders.tone")} />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">
                {t("scriptsCreator.regenDialog.labels.structure")}
              </div>
              <Select value={regenStructure} onValueChange={setRegenStructure}>
                <SelectTrigger>
                  <SelectValue placeholder={t("scriptsCreator.regenDialog.placeholders.structure")} />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>
              {t("scriptsCreator.regenDialog.actions.cancel")}
            </Button>
            <Button
              onClick={async () => {
                setRegenDialogOpen(false);
                await regenerateScript({
                  tone: regenTone,
                  structure: regenStructure,
                });
              }}
            >
              {t("scriptsCreator.regenDialog.actions.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("scriptsCreator.checkout.message")}
      />
    </>
  );
}
