"use client";

import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
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

import { ScriptForm } from "./ScriptForm";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

interface Props {
  onCreated?: (script: any) => void;
  onCancel?: () => void;
}

export default function ScriptCreatorContainer({ onCreated, onCancel }: Props) {
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

  // Script generado / modal
  const [script, setScript] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [scriptRegens, setScriptRegens] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

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

  const regenerateScript = useCallback(async () => {
    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
      return;
    }
    setScriptRegens((c) => c + 1);

    const loadingId = toast.loading("🔄 Regenerando guion...");
    try {
      if (!user) throw new Error("No autenticado");
      const idToken = await user.getIdToken();

      const res = await fetch("/api/chatgpt/scripts/regenerate", {
        method: "POST",
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
        }),
      });

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");

      setScript(parsed.script || "");
      toast.success("✅ Guion regenerado", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el guion.", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  }, [
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
  ]);

  const acceptScript = useCallback(async () => {
    if (!user) return;

    flushSync(() => setShowModal(false));
    const toastId = toast.loading("💾 Guardando guion...");
    setSaving(true);

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

      const createdAtMs = Date.now();
      const created = {
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
        isAI: true,
        createdAt: {
          seconds: Math.floor(createdAtMs / 1000),
          nanoseconds: (createdAtMs % 1000) * 1_000_000,
        },
      };

      toast.success("✅ Guion guardado correctamente", { id: toastId });
      onCreated?.(created); // 👉 cierra el modal padre y refresca lista
    } catch (err) {
      console.error("❌ Error al guardar guion:", err);
      toast.error("No se pudo guardar el guion.", { id: toastId });
    } finally {
      setSaving(false);
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
    onCreated,
  ]);

  return (
    <>
      <ScriptForm
        description={description}
        tone={tone}
        platform={platform}
        duration={duration}
        language={language}
        structure={structure}
        addCTA={addCTA}
        ctaText={ctaText}
        loading={loading || saving}
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
              onClick={regenerateScript}
              disabled={scriptRegens >= 2 || saving}
            >
              Regenerar ({scriptRegens}/2)
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={acceptScript} disabled={saving}>
                {saving ? "Guardando..." : "Aceptar y guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar guiones. Empieza tu prueba GRATUITA de 7 días."
      />
    </>
  );
}
