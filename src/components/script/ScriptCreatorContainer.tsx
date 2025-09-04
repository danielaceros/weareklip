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

/* Opciones (puedes alinearlas con las del <ScriptForm>) */
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
  onClose?: () => void; // 👈 para cerrar el modal padre también
   onCreated?: (newScript: any) => void; // 👈 pasa el objeto creado
}

export default function ScriptCreatorContainer({
  onClose,
  onCreated,
}: ScriptCreatorContainerProps) {
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
      toast.error("⚠️ Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para crear guiones.");
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
        err instanceof Error ? err.message : "No se pudo generar el guion."
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
  ]);

  // 🔄 Regenerar script (acepta overrides desde el mini-diálogo)
  const regenerateScript = useCallback(
    async (overrides?: { tone?: string; structure?: string }) => {
      if (scriptRegens >= 2) {
        toast.error("⚠️ Ya has regenerado el guion 2 veces.");
        return;
      }

      const toneToSend = overrides?.tone ?? tone;
      const structToSend = overrides?.structure ?? structure;

      const loadingId = toast.loading("🔄 Regenerando guion...");
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
        setScriptRegens((c) => c + 1); // ✅ cuenta solo si salió bien
        setTone(toneToSend); // ✅ reflejamos cambios en el form
        setStructure(structToSend);

        toast.success(
          `✅ Guion regenerado (${Math.min(scriptRegens + 1, 2)}/2)`,
          { id: loadingId }
        );
      } catch (err) {
        console.error(err);
        toast.error("❌ No se pudo regenerar el guion.", { id: loadingId });
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
    ]
  );

  // 💾 Aceptar y guardar script
  const acceptScript = useCallback(async () => {
    if (!user) return;

    const toastId = toast.loading("💾 Guardando guion...");

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

      toast.success("✅ Guion guardado correctamente", { id: toastId });

      // 1️⃣ Cerrar modal secundario
      setShowModal(false);

      // 2️⃣ Notificar al padre que se creó un guion
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

      // 3️⃣ Cerrar modal principal si hay `onClose`
      if (typeof onClose === "function") {
        onClose();
      }

      // 4️⃣ Refrescar/navegar
      if (window.location.pathname === "/dashboard/script") {
        router.refresh(); // asegura sincronización con server
      } else {
        router.push("/dashboard/script");
      }

    } catch (err) {
      console.error("❌ Error al guardar guion:", err);
      toast.error("No se pudo guardar el guion.", { id: toastId });
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
  ]);

  /* Abre el mini-diálogo con los valores actuales */
  const openRegenDialog = () => {
    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
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
            <DialogTitle>Guion generado</DialogTitle>
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
              Regenerar ({scriptRegens}/2)
            </Button>
            <Button onClick={acceptScript}>Aceptar y guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mini-diálogo para cambiar Tono y Estructura */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modificar antes de regenerar</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Tono</div>
              <Select value={regenTone} onValueChange={setRegenTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tono" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Estructura</div>
              <Select value={regenStructure} onValueChange={setRegenStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estructura" />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>
              Cancelar
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
              Aceptar y regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar guiones. Empieza tu prueba GRATUITA de 7 días."
      />
    </>
  );
}
